import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The admin bulk actions (Delete All products / Remove All offers) against an in-memory Firestore fake —
 * no production data, no emulator. Proves: authorization, the stale-count guard, exactly-what-was-
 * confirmed deletion, chunked partial-failure reporting, that ONLY product documents are touched
 * (orders, customers, categories, showcases survive), and that an order holding a deleted product can
 * still be cancelled.
 */

type Doc = Record<string, unknown>;
const store = new Map<string, Doc>(); // "collection/id" -> data

vi.mock("server-only", () => ({}));
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { increment: (n: number) => ({ __inc: n }), serverTimestamp: () => "TS" },
}));
vi.mock("@/lib/utils/logger", () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));
const invalidateMock = vi.fn();
vi.mock("@/lib/cache/invalidate", () => ({ invalidateStorefrontCatalog: () => invalidateMock() }));

let role: "OWNER" | "ADMIN" | "CUSTOMER" | null = "ADMIN";
vi.mock("@/lib/firebase/guards", () => {
  class UnauthenticatedError extends Error {}
  class ForbiddenError extends Error {}
  return {
    UnauthenticatedError,
    ForbiddenError,
    requireAdmin: async () => {
      if (!role) throw new UnauthenticatedError();
      if (role === "CUSTOMER") throw new ForbiddenError();
      return { uid: "admin-1", role };
    },
  };
});

const ref = (collection: string, id: string) => ({ collection, id, path: `${collection}/${id}` });

let commits = 0;
let failOnCommit: number | null = null;
const batchSizes: number[] = [];

function apply(target: Doc, patch: Doc) {
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === "object" && "__inc" in (v as Doc)) {
      target[k] = ((target[k] as number) ?? 0) + (v as { __inc: number }).__inc;
    } else target[k] = v;
  }
}

const db = {
  batch: () => {
    const ops: Array<() => void> = [];
    return {
      delete: (r: { path: string }) => ops.push(() => store.delete(r.path)),
      update: (r: { path: string }, patch: Doc) => ops.push(() => apply(store.get(r.path)!, patch)),
      commit: async () => {
        commits += 1;
        if (failOnCommit === commits) throw new Error("boom");
        batchSizes.push(ops.length);
        ops.forEach((op) => op());
      },
    };
  },
  runTransaction: async (fn: (tx: unknown) => Promise<unknown>) => {
    const writes: Array<() => void> = [];
    const tx = {
      get: async (r: { path: string }) => {
        const data = store.get(r.path);
        return { exists: Boolean(data), data: () => (data ? structuredClone(data) : undefined) };
      },
      update: (r: { path: string }, patch: Doc) =>
        writes.push(() => apply(store.get(r.path)!, patch)),
    };
    const out = await fn(tx);
    writes.forEach((w) => w());
    return out;
  },
} as unknown as FirebaseFirestore.Firestore;

const ids = (collection: string) =>
  [...store.keys()].filter((k) => k.startsWith(`${collection}/`)).map((k) => k.split("/")[1]);

vi.mock("@/lib/firebase/firestore", () => ({
  getAdminFirestore: () => db,
  productsCollection: () => ({
    doc: (id: string) => ref("products", id),
    listDocuments: async () => ids("products").map((id) => ref("products", id)),
    get: async () => ({
      // A real snapshot keeps its data after the document is deleted, so capture it now.
      docs: ids("products").map((id) => {
        const data = structuredClone(store.get(`products/${id}`));
        return { id, ref: ref("products", id), data: () => data };
      }),
    }),
  }),
  categoryShowcasesCollection: () => ({ get: async () => ({ docs: [] }) }),
  ordersCollection: () => ({ doc: (id: string) => ref("orders", id) }),
}));
// Storage is exercised in product-image-cleanup.test.ts; here it only has to exist.
vi.mock("@/lib/firebase/admin", () => ({
  getAdminStorage: () => ({
    bucket: () => ({ name: "tia-bucket", file: () => ({ delete: async () => undefined }) }),
  }),
}));

const { deleteAllProductsAction, removeAllOffersAction } =
  await import("@/actions/admin/bulk.actions");
const { transitionOrderStatus } = await import("@/lib/domain/orders/order-status.service");

function seed(productCount = 5, withOffers = 3) {
  store.clear();
  for (let i = 0; i < productCount; i++) {
    const offer = i < withOffers;
    store.set(`products/p${i}`, {
      name: { en: `Product ${i}` },
      price: 24000,
      stock: 5,
      isOnSale: offer,
      salePrice: offer ? 12000 : null,
      saleStartAt: null,
      saleEndAt: null,
    });
  }
  store.set("orders/o1", {
    orderNumber: "ELR-1",
    status: "PENDING",
    items: [{ productId: "p0", unitPrice: 12000, quantity: 1 }],
  });
  store.set("orders/o2", {
    orderNumber: "ELR-2",
    status: "DELIVERED",
    items: [{ productId: "p1", unitPrice: 24000, quantity: 2 }],
  });
  store.set("users/u1", { email: "a@b.c", role: "CUSTOMER" });
  store.set("categories/rings", { name: { en: "Rings" } });
  store.set("categoryShowcases/s1", { categoryId: "rings" });
  store.set("deliveryLocations/ramallah", { isActive: true });
}

const snapshotOf = (collection: string) =>
  structuredClone([...store.entries()].filter(([k]) => k.startsWith(`${collection}/`)));
const UNRELATED = ["orders", "users", "categories", "categoryShowcases", "deliveryLocations"];

beforeEach(() => {
  seed();
  role = "ADMIN";
  commits = 0;
  failOnCommit = null;
  batchSizes.length = 0;
  invalidateMock.mockClear();
});

describe("authorization (server-side)", () => {
  it.each([
    ["nobody signed in", null],
    ["a customer", "CUSTOMER"],
  ] as const)("refuses both actions for %s and changes nothing", async (_label, who) => {
    role = who;
    const before = structuredClone([...store.entries()]);
    for (const action of [deleteAllProductsAction, removeAllOffersAction]) {
      const result = await action({ expectedCount: 5 });
      expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    }
    expect([...store.entries()]).toEqual(before);
    expect(invalidateMock).not.toHaveBeenCalled();
  });

  it.each(["OWNER", "ADMIN"] as const)("allows an %s", async (who) => {
    role = who;
    expect((await deleteAllProductsAction({ expectedCount: 5 })).ok).toBe(true);
  });

  it("validates the input: a missing, zero or non-integer count is rejected", async () => {
    for (const input of [
      {},
      { expectedCount: 0 },
      { expectedCount: 1.5 },
      { expectedCount: "5" },
      null,
    ]) {
      expect((await deleteAllProductsAction(input)).ok).toBe(false);
    }
    expect(ids("products")).toHaveLength(5);
  });
});

describe("Delete All products", () => {
  it("deletes exactly the confirmed products and reports the count", async () => {
    const result = await deleteAllProductsAction({ expectedCount: 5 });
    expect(result).toEqual({ ok: true, data: { count: 5, imagesDeleted: 0, imagesFailed: 0 } });
    expect(ids("products")).toEqual([]);
    expect(invalidateMock).toHaveBeenCalledTimes(1);
  });

  it("never touches orders, customers, categories, showcases or delivery locations", async () => {
    const before = Object.fromEntries(UNRELATED.map((c) => [c, snapshotOf(c)]));
    await deleteAllProductsAction({ expectedCount: 5 });
    for (const c of UNRELATED) expect(snapshotOf(c)).toEqual(before[c]);
  });

  it("refuses when the count changed since the dialog (stale UI) and deletes nothing", async () => {
    const result = await deleteAllProductsAction({ expectedCount: 4 });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "STALE_COUNT", fieldErrors: { remaining: ["5"] } },
    });
    expect(ids("products")).toHaveLength(5);
    expect(commits).toBe(0);
    expect(invalidateMock).not.toHaveBeenCalled();
  });

  it("deletes in chunks under the Firestore batch limit", async () => {
    seed(950, 0);
    const result = await deleteAllProductsAction({ expectedCount: 950 });
    expect(result).toEqual({ ok: true, data: { count: 950, imagesDeleted: 0, imagesFailed: 0 } });
    expect(batchSizes).toEqual([400, 400, 150]);
    expect(batchSizes.every((n) => n <= 500)).toBe(true);
  });

  it("reports a partial failure honestly, keeps what was committed, and can simply be run again", async () => {
    seed(950, 0);
    failOnCommit = 2;
    const partial = await deleteAllProductsAction({ expectedCount: 950 });
    expect(partial).toMatchObject({
      ok: false,
      error: { code: "PARTIAL_FAILURE", fieldErrors: { done: ["400"], remaining: ["550"] } },
    });
    expect(ids("products")).toHaveLength(550);
    expect(invalidateMock).toHaveBeenCalled(); // the catalog did change

    failOnCommit = null;
    const rerun = await deleteAllProductsAction({ expectedCount: 550 });
    expect(rerun).toEqual({ ok: true, data: { count: 550, imagesDeleted: 0, imagesFailed: 0 } });
    expect(ids("products")).toEqual([]);
  });

  it("a failure of the very first chunk changes nothing and says so", async () => {
    failOnCommit = 1;
    const result = await deleteAllProductsAction({ expectedCount: 5 });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "FAILED", fieldErrors: { done: ["0"] } },
    });
    expect(ids("products")).toHaveLength(5);
    expect(invalidateMock).not.toHaveBeenCalled();
  });
});

describe("Remove All offers", () => {
  it("clears the offer fields of every product that has one — and keeps every product", async () => {
    const result = await removeAllOffersAction({ expectedCount: 3 });
    expect(result).toEqual({ ok: true, data: { count: 3 } });
    expect(ids("products")).toHaveLength(5);
    for (const i of [0, 1, 2]) {
      expect(store.get(`products/p${i}`)).toMatchObject({
        isOnSale: false,
        salePrice: null,
        saleStartAt: null,
        saleEndAt: null,
        price: 24000,
        stock: 5,
        name: { en: `Product ${i}` },
      });
    }
  });

  it("leaves products without an offer, and all other collections, exactly as they were", async () => {
    const plain = structuredClone(store.get("products/p4"));
    const before = Object.fromEntries(UNRELATED.map((c) => [c, snapshotOf(c)]));
    await removeAllOffersAction({ expectedCount: 3 });
    expect(store.get("products/p4")).toEqual(plain);
    for (const c of UNRELATED) expect(snapshotOf(c)).toEqual(before[c]);
  });

  it("keeps the price paid on existing orders (stored on the order, not derived from the offer)", async () => {
    await removeAllOffersAction({ expectedCount: 3 });
    expect((store.get("orders/o1")!.items as Array<{ unitPrice: number }>)[0].unitPrice).toBe(
      12000,
    );
  });

  it("counts a switched-off offer too, and refuses a stale count without writing", async () => {
    store.get("products/p0")!.isOnSale = false; // DISABLED but still listed (keeps its sale price)
    expect((await removeAllOffersAction({ expectedCount: 2 })).ok).toBe(false);
    expect(store.get("products/p0")!.salePrice).toBe(12000);
    expect((await removeAllOffersAction({ expectedCount: 3 })).ok).toBe(true);
    expect(store.get("products/p0")!.salePrice).toBeNull();
  });

  it("reports a partial failure with the done/remaining counts", async () => {
    seed(950, 950);
    failOnCommit = 3;
    const result = await removeAllOffersAction({ expectedCount: 950 });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "PARTIAL_FAILURE", fieldErrors: { done: ["800"], remaining: ["150"] } },
    });
    expect(ids("products")).toHaveLength(950);
  });
});

describe("relational safety: cancelling an order whose product was deleted", () => {
  it("still works — the deleted product is skipped, the others are restocked", async () => {
    store.set("orders/o3", {
      orderNumber: "ELR-3",
      status: "PENDING",
      items: [
        { productId: "p0", quantity: 2 },
        { productId: "gone", quantity: 1 },
      ],
    });
    store.get("products/p0")!.salesCount = 4;
    const result = await transitionOrderStatus(db, "o3", "CANCELLED");
    expect(result).toEqual({ ok: true });
    expect(store.get("orders/o3")!.status).toBe("CANCELLED");
    expect(store.get("products/p0")).toMatchObject({ stock: 7, salesCount: 2 });
    expect(store.has("products/gone")).toBe(false); // not resurrected
  });

  it("after Delete All, an open order can still be cancelled", async () => {
    await deleteAllProductsAction({ expectedCount: 5 });
    const result = await transitionOrderStatus(db, "o1", "CANCELLED");
    expect(result).toEqual({ ok: true });
    expect(store.get("orders/o1")!.status).toBe("CANCELLED");
  });
});
