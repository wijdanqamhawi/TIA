import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Storage cleanup when products are deleted (Delete All, single delete and remove-image share ONE
 * implementation). Firestore and Storage are in-memory fakes — nothing here can touch a real bucket or any
 * production data. The point is to prove that ONLY files provably owned by a deleted product are removed,
 * that failures are reported accurately, and that nothing else is disturbed.
 */

type Doc = Record<string, unknown>;
const store = new Map<string, Doc>(); // "collection/id" -> data
const bucketFiles = new Set<string>(); // object paths currently in Storage
const deleteCalls: string[] = [];
const failPaths = new Set<string>();
let storageBroken = false;
let showcasesReadFails = false;
const BUCKET = "tia-bucket";

vi.mock("server-only", () => ({}));
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { increment: (n: number) => ({ __inc: n }), serverTimestamp: () => "TS" },
}));
vi.mock("@/lib/utils/logger", () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));
const invalidateMock = vi.fn();
vi.mock("@/lib/cache/invalidate", () => ({ invalidateStorefrontCatalog: () => invalidateMock() }));
// The single-delete module imports these; they are not exercised by a delete.
vi.mock("@/lib/domain/catalog/product.service", () => ({
  deriveProductSlug: vi.fn(),
  assertUniqueProductSlug: vi.fn(),
}));
vi.mock("@/lib/domain/catalog/category.service", () => ({ categoryExists: vi.fn() }));

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

function apply(target: Doc, patch: Doc) {
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === "object" && "__inc" in (v as Doc)) {
      target[k] = ((target[k] as number) ?? 0) + (v as { __inc: number }).__inc;
    } else target[k] = v;
  }
}

function ref(collection: string, id: string) {
  const path = `${collection}/${id}`;
  return {
    collection,
    id,
    path,
    get: async () => {
      const data = store.get(path);
      return { exists: Boolean(data), id, data: () => (data ? structuredClone(data) : undefined) };
    },
    update: async (patch: Doc) => apply(store.get(path)!, patch),
    delete: async () => void store.delete(path),
  };
}
const ids = (collection: string) =>
  [...store.keys()].filter((k) => k.startsWith(`${collection}/`)).map((k) => k.split("/")[1]);
// A real snapshot keeps its data after the document is deleted, so capture it when read.
const docsOf = (collection: string) =>
  ids(collection).map((id) => {
    const data = structuredClone(store.get(`${collection}/${id}`));
    return { id, ref: ref(collection, id), data: () => data };
  });

let commits = 0;
let failOnCommit: number | null = null;
const db = {
  batch: () => {
    const ops: Array<() => void> = [];
    return {
      delete: (r: { path: string }) => ops.push(() => store.delete(r.path)),
      update: (r: { path: string }, patch: Doc) => ops.push(() => apply(store.get(r.path)!, patch)),
      commit: async () => {
        commits += 1;
        if (failOnCommit === commits) throw new Error("boom");
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

vi.mock("@/lib/firebase/firestore", () => ({
  getAdminFirestore: () => db,
  productsCollection: () => ({
    doc: (id: string) => ref("products", id),
    get: async () => ({ docs: docsOf("products") }),
  }),
  categoryShowcasesCollection: () => ({
    get: async () => {
      if (showcasesReadFails) throw new Error("showcases unreadable");
      return { docs: docsOf("categoryShowcases") };
    },
  }),
  ordersCollection: () => ({ doc: (id: string) => ref("orders", id) }),
}));
vi.mock("@/lib/firebase/admin", () => ({
  getAdminStorage: () => ({
    bucket: () => {
      if (storageBroken) throw new Error("storage unavailable");
      return {
        name: BUCKET,
        file: (path: string) => ({
          delete: async () => {
            deleteCalls.push(path);
            if (failPaths.has(path)) throw new Error(`denied: ${path}`);
            bucketFiles.delete(path);
          },
        }),
      };
    },
  }),
}));

const { deleteAllProductsAction } = await import("@/actions/admin/bulk.actions");
const { deleteProductAction } = await import("@/actions/admin/product.actions");
const { removeProductImageAction } = await import("@/actions/admin/media.actions");
const { isOwnedProductImage } = await import("@/lib/domain/admin/product-images");
const { transitionOrderStatus } = await import("@/lib/domain/orders/order-status.service");

const downloadUrl = (path: string, bucket = BUCKET) =>
  `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media&token=t`;
const img = (path: string) => ({
  url: downloadUrl(path),
  storagePath: path,
  position: 0,
  alt: "Photo",
});

function addProduct(id: string, images: unknown[]) {
  store.set(`products/${id}`, { name: { en: id }, price: 1000, stock: 3, salesCount: 1, images });
}

/** Three products plus every kind of file that must NOT be touched. */
function seed() {
  store.clear();
  bucketFiles.clear();
  deleteCalls.length = 0;
  failPaths.clear();
  storageBroken = false;
  showcasesReadFails = false;

  addProduct("p1", [img("products/p1/a.jpg"), img("products/p1/b.jpg")]);
  addProduct("p2", [
    img("products/p2/c.jpg"),
    // A product pointing at the shared brand logo: a local asset, never a product-owned upload.
    { url: "/brand/logo.svg", storagePath: "brand/logo.svg", position: 1, alt: "Logo" },
  ]);
  // Seeded demo data: lives under seed/, not in the product's own folder.
  addProduct("p3", [img("seed/products/demo.jpg")]);

  for (const path of [
    "products/p1/a.jpg",
    "products/p1/b.jpg",
    "products/p2/c.jpg",
    "seed/products/demo.jpg",
    // Everything that is not a deleted product's own photo:
    "brand/logo.svg",
    "brand/hero.jpg",
    "showcases/s1/desktop.jpg",
    "showcases/s1/mobile.jpg",
    "categories/rings/cover.jpg",
    "products/orphan/z.jpg", // a product folder nothing references and no deleted product owns
  ]) {
    bucketFiles.add(path);
  }

  store.set("categoryShowcases/s1", {
    categoryId: "rings",
    desktopImage: {
      url: downloadUrl("showcases/s1/desktop.jpg"),
      storagePath: "showcases/s1/desktop.jpg",
    },
    mobileImage: {
      url: downloadUrl("showcases/s1/mobile.jpg"),
      storagePath: "showcases/s1/mobile.jpg",
    },
  });
  store.set("orders/o1", {
    orderNumber: "ELR-1",
    status: "PENDING",
    userId: "u1",
    items: [
      {
        productId: "p1",
        productName: { en: "Ring" },
        unitPrice: 12000,
        originalPrice: 24000,
        wasOnSale: true,
        quantity: 2,
      },
    ],
    subtotal: 24000,
    total: 24000,
  });
  store.set("users/u1", { email: "a@b.c", role: "CUSTOMER" });
  store.set("categories/rings", { name: { en: "Rings" } });
  store.set("deliveryLocations/ramallah", { isActive: true });
  store.set("admins/owner", { role: "OWNER" });
}

const UNRELATED_DOCS = [
  "orders",
  "users",
  "categories",
  "categoryShowcases",
  "deliveryLocations",
  "admins",
];
const snapshotOf = (collection: string) =>
  structuredClone([...store.entries()].filter(([k]) => k.startsWith(`${collection}/`)));
const NEVER_DELETABLE = [
  "brand/logo.svg",
  "brand/hero.jpg",
  "showcases/s1/desktop.jpg",
  "showcases/s1/mobile.jpg",
  "categories/rings/cover.jpg",
  "products/orphan/z.jpg",
  "seed/products/demo.jpg",
];

beforeEach(() => {
  seed();
  role = "ADMIN";
  commits = 0;
  failOnCommit = null;
  invalidateMock.mockClear();
});

describe("how product image ownership is decided", () => {
  const owned = (productId: string, image: Parameters<typeof isOwnedProductImage>[1]) =>
    isOwnedProductImage(productId, image, BUCKET);

  it("accepts only an upload in the product's OWN folder whose download URL names that same object", () => {
    expect(owned("p1", img("products/p1/a.jpg"))).toBe(true);
    // The emulator / other hosts use the same /v0/b/<bucket>/o/<path> shape.
    expect(
      owned("p1", {
        url: `http://127.0.0.1:9199/v0/b/${BUCKET}/o/products%2Fp1%2Fa.jpg?alt=media`,
        storagePath: "products/p1/a.jpg",
      }),
    ).toBe(true);
  });

  it.each([
    [
      "the TIA logo as a local asset",
      "p1",
      { url: "/brand/logo.svg", storagePath: "brand/logo.svg" },
    ],
    ["a brand asset in Storage", "p1", img("brand/logo.svg")],
    ["a hero image", "p1", img("brand/hero.jpg")],
    ["a showcase image", "p1", img("showcases/s1/desktop.jpg")],
    ["a category image", "p1", img("categories/rings/cover.jpg")],
    ["the seeded demo files", "p3", img("seed/products/demo.jpg")],
    ["another product's folder", "p1", img("products/p2/c.jpg")],
    ["a nested path", "p1", img("products/p1/sub/a.jpg")],
    ["a path that only ends like a product file", "p1", img("evil/products/p1/a.jpg")],
    [
      "a folder-traversal file name",
      "p1",
      { url: downloadUrl("products/p1/.."), storagePath: "products/p1/.." },
    ],
    [
      "a URL that names a different object than storagePath",
      "p1",
      { url: downloadUrl("brand/logo.svg"), storagePath: "products/p1/a.jpg" },
    ],
    [
      "a URL from another bucket",
      "p1",
      {
        url: downloadUrl("products/p1/a.jpg", "someone-elses-bucket"),
        storagePath: "products/p1/a.jpg",
      },
    ],
    ["a root-relative URL", "p1", { url: "/products/p1/a.jpg", storagePath: "products/p1/a.jpg" }],
    [
      "a non-http URL",
      "p1",
      { url: "ftp://x/o/products%2Fp1%2Fa.jpg", storagePath: "products/p1/a.jpg" },
    ],
    ["a missing storagePath", "p1", { url: downloadUrl("products/p1/a.jpg"), storagePath: "" }],
    ["a missing url", "p1", { storagePath: "products/p1/a.jpg" }],
  ])("refuses %s (ownership cannot be proven)", (_label, productId, image) => {
    expect(owned(productId, image as never)).toBe(false);
  });
});

describe("Delete All products", () => {
  it("deletes the product documents AND exactly the images they own", async () => {
    const result = await deleteAllProductsAction({ expectedCount: 3 });
    expect(result).toEqual({ ok: true, data: { count: 3, imagesDeleted: 3, imagesFailed: 0 } });
    expect(ids("products")).toEqual([]);
    expect([...deleteCalls].sort()).toEqual([
      "products/p1/a.jpg",
      "products/p1/b.jpg",
      "products/p2/c.jpg",
    ]);
    for (const gone of deleteCalls) expect(bucketFiles.has(gone)).toBe(false);
  });

  it("NEVER deletes shared/default, brand, hero, showcase, category, seeded or orphaned files", async () => {
    await deleteAllProductsAction({ expectedCount: 3 });
    for (const path of NEVER_DELETABLE) {
      expect(deleteCalls).not.toContain(path);
      expect(bucketFiles.has(path)).toBe(true);
    }
  });

  it("leaves orders, customers, categories, showcases, locations and admin accounts untouched", async () => {
    const before = Object.fromEntries(UNRELATED_DOCS.map((c) => [c, snapshotOf(c)]));
    await deleteAllProductsAction({ expectedCount: 3 });
    for (const c of UNRELATED_DOCS) expect(snapshotOf(c)).toEqual(before[c]);
    // The old order still carries its own snapshot, price and quantity.
    expect(store.get("orders/o1")).toMatchObject({
      total: 24000,
      items: [{ productName: { en: "Ring" }, unitPrice: 12000, wasOnSale: true, quantity: 2 }],
    });
  });

  it("does not delete a product file that a homepage showcase still references", async () => {
    // p1's own upload is also (wrongly) used by a showcase: it is shared, so it must stay.
    store.set("categoryShowcases/s2", {
      desktopImage: { url: downloadUrl("products/p1/a.jpg"), storagePath: "products/p1/a.jpg" },
      mobileImage: null,
    });
    const result = await deleteAllProductsAction({ expectedCount: 3 });
    expect(deleteCalls).not.toContain("products/p1/a.jpg");
    expect(bucketFiles.has("products/p1/a.jpg")).toBe(true);
    expect(result).toMatchObject({
      ok: true,
      data: { count: 3, imagesDeleted: 2, imagesFailed: 0 },
    });
  });

  it("refuses a stale count: nothing is deleted from Firestore or Storage", async () => {
    const result = await deleteAllProductsAction({ expectedCount: 2 });
    expect(result).toMatchObject({ ok: false, error: { code: "STALE_COUNT" } });
    expect(ids("products")).toHaveLength(3);
    expect(deleteCalls).toEqual([]);
  });

  it("is authorization-gated: no session or a customer changes nothing in Firestore or Storage", async () => {
    for (const who of [null, "CUSTOMER"] as const) {
      role = who;
      const result = await deleteAllProductsAction({ expectedCount: 3 });
      expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    }
    expect(ids("products")).toHaveLength(3);
    expect(deleteCalls).toEqual([]);
    expect(bucketFiles.size).toBe(10);
  });

  it("allows an OWNER and an ADMIN", async () => {
    role = "OWNER";
    expect((await deleteAllProductsAction({ expectedCount: 3 })).ok).toBe(true);
  });
});

describe("Storage failures are reported, never hidden", () => {
  it("product documents deleted but some files fail: still ok, with the exact failed count — and the rest are cleaned", async () => {
    failPaths.add("products/p1/b.jpg");
    failPaths.add("products/p2/c.jpg");
    const result = await deleteAllProductsAction({ expectedCount: 3 });
    expect(result).toEqual({ ok: true, data: { count: 3, imagesDeleted: 1, imagesFailed: 2 } });
    expect(ids("products")).toEqual([]);
    // The failed files are still in Storage; the one that worked is gone; nothing else was touched.
    expect(bucketFiles.has("products/p1/b.jpg")).toBe(true);
    expect(bucketFiles.has("products/p2/c.jpg")).toBe(true);
    expect(bucketFiles.has("products/p1/a.jpg")).toBe(false);
    for (const path of NEVER_DELETABLE) expect(bucketFiles.has(path)).toBe(true);
  });

  it("if Storage is unavailable the products are still deleted and every owned file is reported failed", async () => {
    storageBroken = true;
    const result = await deleteAllProductsAction({ expectedCount: 3 });
    expect(result).toEqual({ ok: true, data: { count: 3, imagesDeleted: 0, imagesFailed: 3 } });
    expect(ids("products")).toEqual([]);
    expect(deleteCalls).toEqual([]);
  });

  it("if references cannot be verified, NOTHING is deleted from Storage (it cannot be proven safe)", async () => {
    showcasesReadFails = true;
    const result = await deleteAllProductsAction({ expectedCount: 3 });
    expect(result).toEqual({ ok: true, data: { count: 3, imagesDeleted: 0, imagesFailed: 3 } });
    expect(deleteCalls).toEqual([]);
    expect(bucketFiles.size).toBe(10);
  });

  it("a partial Firestore failure cleans only the products already deleted; the rest keep their files", async () => {
    store.clear();
    bucketFiles.clear();
    for (let i = 0; i < 450; i++) {
      addProduct(`m${i}`, [img(`products/m${i}/f.jpg`)]);
      bucketFiles.add(`products/m${i}/f.jpg`);
    }
    failOnCommit = 2; // the first 400 commit, the last 50 fail
    const result = await deleteAllProductsAction({ expectedCount: 450 });
    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "PARTIAL_FAILURE",
        fieldErrors: { done: ["400"], remaining: ["50"], imagesFailed: ["0"] },
      },
    });
    expect(ids("products")).toHaveLength(50);
    expect(deleteCalls).toHaveLength(400);
    // The 50 products still in the catalog keep their images — nothing was deleted "just in case".
    const remaining = ids("products");
    for (const id of remaining) expect(bucketFiles.has(`products/${id}/f.jpg`)).toBe(true);
    expect(bucketFiles.size).toBe(50);
  });

  it("if the first chunk fails, no product and no file is touched", async () => {
    failOnCommit = 1;
    const result = await deleteAllProductsAction({ expectedCount: 3 });
    expect(result).toMatchObject({ ok: false, error: { code: "FAILED" } });
    expect(ids("products")).toHaveLength(3);
    expect(deleteCalls).toEqual([]);
  });
});

describe("single product delete uses the same cleanup", () => {
  it("deletes the product and only its own images", async () => {
    const result = await deleteProductAction({ productId: "p1" });
    expect(result).toEqual({ ok: true, data: { imagesFailed: 0 } });
    expect(store.has("products/p1")).toBe(false);
    expect([...deleteCalls].sort()).toEqual(["products/p1/a.jpg", "products/p1/b.jpg"]);
    // Other products and their files are untouched.
    expect(store.has("products/p2")).toBe(true);
    expect(bucketFiles.has("products/p2/c.jpg")).toBe(true);
  });

  it("never deletes the shared default image or any other unrelated file", async () => {
    await deleteProductAction({ productId: "p2" });
    expect(deleteCalls).toEqual(["products/p2/c.jpg"]);
    for (const path of NEVER_DELETABLE) expect(bucketFiles.has(path)).toBe(true);
    await deleteProductAction({ productId: "p3" }); // seeded demo file: not provably product-owned
    expect(deleteCalls).toEqual(["products/p2/c.jpg"]);
    expect(bucketFiles.has("seed/products/demo.jpg")).toBe(true);
  });

  it("keeps a file that another product still references", async () => {
    // p2 (still in the catalog) shows p1's photo: deleting p1 must not remove it.
    store.get("products/p2")!.images = [img("products/p1/a.jpg")];
    await deleteProductAction({ productId: "p1" });
    expect(deleteCalls).toEqual(["products/p1/b.jpg"]);
    expect(bucketFiles.has("products/p1/a.jpg")).toBe(true);
  });

  it("reports leftover files accurately when a delete fails", async () => {
    failPaths.add("products/p1/a.jpg");
    const result = await deleteProductAction({ productId: "p1" });
    expect(result).toEqual({ ok: true, data: { imagesFailed: 1 } });
    expect(store.has("products/p1")).toBe(false);
    expect(bucketFiles.has("products/p1/a.jpg")).toBe(true);
    expect(bucketFiles.has("products/p1/b.jpg")).toBe(false);
  });

  it("is a harmless no-op for a product that does not exist, and is admin-only", async () => {
    expect(await deleteProductAction({ productId: "ghost" })).toEqual({
      ok: true,
      data: { imagesFailed: 0 },
    });
    expect(deleteCalls).toEqual([]);
    role = "CUSTOMER";
    expect(await deleteProductAction({ productId: "p1" })).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
    expect(store.has("products/p1")).toBe(true);
    expect(deleteCalls).toEqual([]);
  });

  it("shares one implementation with Delete All — no second cleanup in the actions", () => {
    const read = (p: string) => readFileSync(resolve(__dirname, "../..", p), "utf8");
    expect(read("src/actions/admin/product.actions.ts")).toContain("deleteProductWithImages");
    expect(read("src/actions/admin/product.actions.ts")).not.toMatch(/bucket\(\)|\.file\(/);
    expect(read("src/lib/domain/admin/bulk.service.ts")).toContain("cleanupProductImages");
    expect(read("src/lib/domain/admin/bulk.service.ts")).not.toMatch(/bucket\(\)|\.file\(/);
    expect(read("src/actions/admin/media.actions.ts")).toContain("cleanupProductImages");
    expect(read("src/actions/admin/media.actions.ts")).not.toMatch(/bucket\(\)|\.file\(/);
  });
});

describe("removing one image from a product", () => {
  it("deletes the file only when it really is one of that product's own images", async () => {
    const result = await removeProductImageAction({
      productId: "p1",
      storagePath: "products/p1/a.jpg",
    });
    expect(result.ok).toBe(true);
    expect(deleteCalls).toEqual(["products/p1/a.jpg"]);
    expect((store.get("products/p1")!.images as unknown[]).length).toBe(1);
  });

  it("never deletes an arbitrary storagePath sent by the client", async () => {
    for (const storagePath of [
      "brand/logo.svg",
      "showcases/s1/desktop.jpg",
      "products/p2/c.jpg",
      "seed/products/demo.jpg",
    ]) {
      await removeProductImageAction({ productId: "p1", storagePath });
    }
    expect(deleteCalls).toEqual([]);
    for (const path of bucketFiles) expect(bucketFiles.has(path)).toBe(true);
    expect(bucketFiles.size).toBe(10);
  });

  it("does not delete the default image when that is the one removed", async () => {
    await removeProductImageAction({ productId: "p2", storagePath: "brand/logo.svg" });
    expect(deleteCalls).toEqual([]);
    expect(bucketFiles.has("brand/logo.svg")).toBe(true);
    // The product's metadata still changed: the reference is gone.
    expect((store.get("products/p2")!.images as unknown[]).length).toBe(1);
  });
});

describe("historical orders after a deletion", () => {
  it("an open order containing a deleted product can still be cancelled", async () => {
    await deleteAllProductsAction({ expectedCount: 3 });
    const result = await transitionOrderStatus(db, "o1", "CANCELLED");
    expect(result).toEqual({ ok: true });
    expect(store.get("orders/o1")).toMatchObject({
      status: "CANCELLED",
      total: 24000,
      items: [{ productName: { en: "Ring" }, unitPrice: 12000, quantity: 2 }],
    });
    expect(store.has("products/p1")).toBe(false); // not resurrected by the restock
  });

  it("the cleanup module never reads or writes orders, customers or categories", () => {
    const src = readFileSync(
      resolve(__dirname, "../../src/lib/domain/admin/product-images.ts"),
      "utf8",
    );
    expect(src).not.toMatch(
      /ordersCollection|usersCollection|categoriesCollection|deliveryLocationsCollection|getAdminAuth/,
    );
    // Only the paths under a product's own folder can ever be deleted.
    expect(src).toContain("products\\/([^/]+)\\/([^/]+)");
  });
});
