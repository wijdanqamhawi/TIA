import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Order, OrderStatus } from "@/types/order";

/**
 * The customer order-edit transaction against an in-memory Firestore fake — no production data,
 * no emulator. The fake is transactional enough to prove the rules: reads come from the store,
 * writes are buffered and applied only when the callback completes without throwing.
 */

type Doc = Record<string, unknown>;
const store = new Map<string, Doc>(); // "collection/id" -> data

vi.mock("server-only", () => ({}));
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    increment: (n: number) => ({ __inc: n }),
    serverTimestamp: () => "TS",
  },
}));

function ref(collection: string, id: string) {
  return { collection, id, path: `${collection}/${id}` };
}
vi.mock("@/lib/firebase/firestore", () => ({
  productsCollection: () => ({ doc: (id: string) => ref("products", id) }),
  deliveryRegionsCollection: () => ({ doc: (id: string) => ref("deliveryRegions", id) }),
  deliveryLocationsCollection: () => ({ doc: (id: string) => ref("deliveryLocations", id) }),
  statsSummaryDoc: () => ref("stats", "summary"),
  ordersCollection: () => ({
    where: (_f: string, _op: string, number: string) => ({
      limit: () => ({
        get: async () => {
          const hit = [...store.entries()].find(
            ([k, v]) => k.startsWith("orders/") && v.orderNumber === number,
          );
          return {
            empty: !hit,
            docs: hit ? [{ ref: ref("orders", hit[0].split("/")[1]) }] : [],
          };
        },
      }),
    }),
  }),
}));
vi.mock("@/lib/domain/catalog/product.service", () => ({
  isSelectedOptionValid: (
    product: { options: Array<{ key: string; values: Array<{ key: string }> }> },
    sel: { optionKey: string; valueKey: string } | null,
  ) =>
    !sel
      ? product.options.length === 0
      : Boolean(
          product.options
            .find((o) => o.key === sel.optionKey)
            ?.values.some((v) => v.key === sel.valueKey),
        ),
}));

function apply(target: Doc, patch: Doc) {
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === "object" && "__inc" in (v as Doc)) {
      target[k] = ((target[k] as number) ?? 0) + (v as { __inc: number }).__inc;
    } else target[k] = v;
  }
}

/** Runs the callback; a `beforeWrite` hook lets a test slip an admin change in mid-flight. */
let beforeCommit: (() => void) | null = null;
const db = {
  runTransaction: async (fn: (tx: unknown) => Promise<unknown>) => {
    const writes: Array<() => void> = [];
    let wrote = false;
    const tx = {
      get: async (r: { path: string }) => {
        if (wrote) throw new Error("read after write");
        const data = store.get(r.path);
        return { exists: Boolean(data), data: () => (data ? structuredClone(data) : undefined) };
      },
      update: (r: { path: string }, patch: Doc) => {
        wrote = true;
        writes.push(() => apply(store.get(r.path)!, patch));
      },
      set: (r: { path: string }, data: Doc) => {
        wrote = true;
        writes.push(() => store.set(r.path, data));
      },
    };
    const out = await fn(tx);
    beforeCommit?.();
    writes.forEach((w) => w());
    return out;
  },
} as unknown as FirebaseFirestore.Firestore;

const { editCustomerOrder } = await import("@/lib/domain/orders/order-edit.service");
const { orderEditSchema } = await import("@/lib/validation/order-edit.schema");

const UID = "u1";
const NUMBER = "ELR-20260930-0001";

function seed(status: OrderStatus = "PENDING", userId: string | null = UID) {
  store.clear();
  store.set("orders/o1", {
    id: "o1",
    orderNumber: NUMBER,
    userId,
    status,
    customerSnapshot: { fullName: "Sara", email: "s@example.com", phone: "0599000000" },
    deliverySnapshot: {
      regionId: "west-bank",
      regionName: { en: "West Bank", ar: "الضفة الغربية" },
      locationId: "ramallah",
      locationName: { en: "Ramallah", ar: "رام الله" },
      fullAddress: "Old street 1",
    },
    items: [
      // Bought during an offer: 120 paid, 240 regular. The product is back to 240 now.
      {
        productId: "watch",
        productName: { en: "Luna Mesh Watch", ar: null },
        selectedOption: null,
        unitPrice: 12000,
        originalPrice: 24000,
        wasOnSale: true,
        quantity: 2,
      },
      {
        productId: "cuff",
        productName: { en: "Aurelia Cuff", ar: null },
        selectedOption: { optionKey: "color", valueKey: "gold", label: { en: "Gold", ar: null } },
        unitPrice: 18500,
        originalPrice: 18500,
        wasOnSale: false,
        quantity: 1,
      },
    ],
    notes: null,
    paymentMethod: "CASH_ON_DELIVERY",
    subtotal: 42500,
    total: 42500,
  } as unknown as Order);
  store.set("products/watch", {
    price: 24000, // today's price — must never re-price the order
    stock: 5,
    salesCount: 10,
    availability: true,
    options: [],
  });
  store.set("products/cuff", {
    price: 18500,
    stock: 3,
    salesCount: 4,
    availability: true,
    options: [{ key: "color", values: [{ key: "gold" }] }],
  });
  store.set("deliveryRegions/west-bank", {
    isActive: true,
    name: { en: "West Bank", ar: "الضفة الغربية" },
  });
  store.set("deliveryRegions/inside-1948", {
    isActive: true,
    name: { en: "Inside 1948", ar: "الداخل" },
  });
  store.set("deliveryLocations/ramallah", {
    isActive: true,
    regionId: "west-bank",
    name: { en: "Ramallah", ar: "رام الله" },
  });
  store.set("deliveryLocations/haifa", {
    isActive: true,
    regionId: "inside-1948",
    name: { en: "Haifa", ar: "حيفا" },
  });
  store.set("stats/summary", { totalSales: 100000, totalOrders: 7 });
}

function input(overrides: Record<string, unknown> = {}) {
  return orderEditSchema.parse({
    orderNumber: NUMBER,
    items: [
      { productId: "watch", optionKey: null, valueKey: null, quantity: 2 },
      { productId: "cuff", optionKey: "color", valueKey: "gold", quantity: 1 },
    ],
    phone: "0599000000",
    regionId: "west-bank",
    locationId: "ramallah",
    fullAddress: "Old street 1",
    notes: null,
    ...overrides,
  });
}

const order = () => store.get("orders/o1") as unknown as Order;
const product = (id: string) =>
  store.get(`products/${id}`) as { stock: number; salesCount: number };

beforeEach(() => {
  seed();
  beforeCommit = null;
});

describe("who and when", () => {
  it("lets the owner edit a PENDING order", async () => {
    seed("PENDING");
    const result = await editCustomerOrder(db, UID, input({ notes: "Ring twice" }));
    expect(result.ok).toBe(true);
    expect(order().notes).toBe("Ring twice");
  });

  it.each(["CONFIRMED", "PREPARING", "SHIPPED", "DELIVERED", "CANCELLED"] as const)(
    "refuses a %s order and writes nothing",
    async (status) => {
      seed(status);
      const before = structuredClone([...store.entries()]);
      const result = await editCustomerOrder(db, UID, input({ notes: "x" }));
      expect(result).toEqual({ ok: false, error: { code: "NOT_EDITABLE", productId: undefined } });
      expect([...store.entries()]).toEqual(before);
    },
  );

  it("does not let another customer — or a guest order's visitor — edit it (same as not found)", async () => {
    const other = await editCustomerOrder(db, "someone-else", input());
    expect(other.ok).toBe(false);
    expect(!other.ok && other.error.code).toBe("NOT_FOUND");
    seed("PENDING", null);
    const guest = await editCustomerOrder(db, UID, input());
    expect(!guest.ok && guest.error.code).toBe("NOT_FOUND");
  });

  it("rejects an unknown order number", async () => {
    const result = await editCustomerOrder(db, UID, input({ orderNumber: "ELR-NOPE" }));
    expect(!result.ok && result.error.code).toBe("NOT_FOUND");
  });

  it("blocks the save when an admin confirmed the order while the customer was editing", async () => {
    // The status changes between the customer's read and their commit: the transaction's own
    // re-read happens first, so model the admin winning BEFORE the customer's transaction runs
    // (the customer opened the page while PENDING; the admin then made it CONFIRMED).
    store.get("orders/o1")!.status = "CONFIRMED";
    const result = await editCustomerOrder(
      db,
      UID,
      input({ items: [{ productId: "watch", quantity: 1 }] }),
    );
    expect(!result.ok && result.error.code).toBe("NOT_EDITABLE");
    expect(order().items).toHaveLength(2);
    expect(product("watch").stock).toBe(5);
  });
});

describe("quantities and inventory", () => {
  it("increases a quantity: takes the extra units from stock, counts them as sold", async () => {
    const result = await editCustomerOrder(
      db,
      UID,
      input({
        items: [
          { productId: "watch", quantity: 4 },
          { productId: "cuff", optionKey: "color", valueKey: "gold", quantity: 1 },
        ],
      }),
    );
    expect(result.ok).toBe(true);
    expect(product("watch")).toMatchObject({ stock: 3, salesCount: 12 });
    expect(order().items[0].quantity).toBe(4);
  });

  it("decreases a quantity: returns the units to stock", async () => {
    await editCustomerOrder(
      db,
      UID,
      input({
        items: [
          { productId: "watch", quantity: 1 },
          { productId: "cuff", optionKey: "color", valueKey: "gold", quantity: 1 },
        ],
      }),
    );
    expect(product("watch")).toMatchObject({ stock: 6, salesCount: 9 });
  });

  it("refuses an increase beyond the available stock and changes nothing", async () => {
    const before = structuredClone([...store.entries()]);
    const result = await editCustomerOrder(
      db,
      UID,
      input({
        items: [
          { productId: "watch", quantity: 8 },
          { productId: "cuff", optionKey: "color", valueKey: "gold", quantity: 1 },
        ],
      }),
    );
    expect(result).toEqual({
      ok: false,
      error: { code: "INSUFFICIENT_STOCK", productId: "watch" },
    });
    expect([...store.entries()]).toEqual(before);
  });

  it("allows an increase up to exactly the remaining stock, never below zero", async () => {
    const result = await editCustomerOrder(
      db,
      UID,
      input({
        items: [
          { productId: "watch", quantity: 7 },
          { productId: "cuff", optionKey: "color", valueKey: "gold", quantity: 1 },
        ],
      }),
    );
    expect(result.ok).toBe(true);
    expect(product("watch").stock).toBe(0);
  });

  it("removes a line explicitly (never a zero quantity) and restocks it", async () => {
    const result = await editCustomerOrder(
      db,
      UID,
      input({ items: [{ productId: "watch", quantity: 2 }] }),
    );
    expect(result.ok).toBe(true);
    expect(order().items).toHaveLength(1);
    expect(order().items.some((i) => i.quantity === 0)).toBe(false);
    expect(product("cuff")).toMatchObject({ stock: 4, salesCount: 3 });
  });

  it("never leaves an order empty", async () => {
    // The schema rejects it outright…
    expect(orderEditSchema.safeParse({ ...input(), items: [] }).success).toBe(false);
    // …and the service refuses lines that match nothing, writing nothing.
    const before = structuredClone([...store.entries()]);
    const result = await editCustomerOrder(db, UID, { ...input(), items: [] });
    expect(!result.ok && result.error.code).toBe("EMPTY_ORDER");
    expect([...store.entries()]).toEqual(before);
  });

  it("rejects a line that is not in the order — no new products can be added", async () => {
    const result = await editCustomerOrder(
      db,
      UID,
      input({
        items: [
          { productId: "watch", quantity: 2 },
          { productId: "other", quantity: 1 },
        ],
      }),
    );
    expect(!result.ok && result.error.code).toBe("INVALID_LINE");
  });

  it("rejects the same line sent twice", async () => {
    const result = await editCustomerOrder(
      db,
      UID,
      input({
        items: [
          { productId: "watch", quantity: 1 },
          { productId: "watch", quantity: 1 },
        ],
      }),
    );
    expect(!result.ok && result.error.code).toBe("INVALID_LINE");
  });

  it("rejects zero, negative and fractional quantities at the schema", () => {
    for (const quantity of [0, -1, 1.5]) {
      expect(
        orderEditSchema.safeParse({ ...input(), items: [{ productId: "watch", quantity }] })
          .success,
      ).toBe(false);
    }
  });

  it("refuses an increase when the product is no longer available or its option is gone", async () => {
    store.get("products/watch")!.availability = false;
    const r1 = await editCustomerOrder(
      db,
      UID,
      input({
        items: [
          { productId: "watch", quantity: 3 },
          { productId: "cuff", optionKey: "color", valueKey: "gold", quantity: 1 },
        ],
      }),
    );
    expect(!r1.ok && r1.error.code).toBe("NOT_AVAILABLE");
    store.get("products/watch")!.availability = true;
    store.get("products/cuff")!.options = [];
    const r2 = await editCustomerOrder(
      db,
      UID,
      input({
        items: [
          { productId: "watch", quantity: 2 },
          { productId: "cuff", optionKey: "color", valueKey: "gold", quantity: 2 },
        ],
      }),
    );
    expect(!r2.ok && r2.error.code).toBe("INVALID_OPTION");
  });

  it("still lets a line be reduced or removed when its product was deleted", async () => {
    store.delete("products/cuff");
    const result = await editCustomerOrder(
      db,
      UID,
      input({ items: [{ productId: "watch", quantity: 2 }] }),
    );
    expect(result.ok).toBe(true);
    expect(store.has("products/cuff")).toBe(false);
  });

  it("is idempotent: submitting the same edit twice moves stock only once", async () => {
    const edit = input({
      items: [
        { productId: "watch", quantity: 4 },
        { productId: "cuff", optionKey: "color", valueKey: "gold", quantity: 1 },
      ],
    });
    await editCustomerOrder(db, UID, edit);
    await editCustomerOrder(db, UID, edit);
    expect(product("watch")).toMatchObject({ stock: 3, salesCount: 12 });
  });
});

describe("pricing", () => {
  it("keeps the stored offer price for kept lines even though the product is back at its regular price", async () => {
    await editCustomerOrder(db, UID, input({ fullAddress: "New street 9" }));
    expect(order().items[0]).toMatchObject({
      unitPrice: 12000,
      originalPrice: 24000,
      wasOnSale: true,
    });
    expect(order().total).toBe(42500);
  });

  it("re-prices a changed quantity at the STORED unit price, and updates subtotal, total and the sales stat", async () => {
    await editCustomerOrder(
      db,
      UID,
      input({
        items: [
          { productId: "watch", quantity: 4 },
          { productId: "cuff", optionKey: "color", valueKey: "gold", quantity: 1 },
        ],
      }),
    );
    expect(order().subtotal).toBe(12000 * 4 + 18500);
    expect(order().total).toBe(12000 * 4 + 18500);
    expect(store.get("stats/summary")).toMatchObject({
      totalSales: 100000 + 24000,
      totalOrders: 7,
    });
  });

  it("ignores a client-supplied price, total, status, owner or stock", async () => {
    const parsed = orderEditSchema.parse({
      ...input(),
      items: [{ productId: "watch", quantity: 2, unitPrice: 1, price: 1, stock: 999 }],
      total: 1,
      subtotal: 1,
      status: "DELIVERED",
      userId: "attacker",
    });
    expect(parsed).not.toHaveProperty("total");
    expect(parsed).not.toHaveProperty("status");
    expect(parsed).not.toHaveProperty("userId");
    expect(parsed.items[0]).not.toHaveProperty("unitPrice");
    await editCustomerOrder(db, UID, parsed);
    expect(order().items[0].unitPrice).toBe(12000);
    expect(order().total).toBe(24000);
    expect(order().status).toBe("PENDING");
    expect(order().userId).toBe(UID);
  });
});

describe("delivery and notes", () => {
  it("updates phone, region, city, address and notes on the same order document", async () => {
    const result = await editCustomerOrder(
      db,
      UID,
      input({
        phone: "0599111222",
        regionId: "inside-1948",
        locationId: "haifa",
        fullAddress: "Harbor 3",
        notes: "After 5pm",
      }),
    );
    expect(result.ok).toBe(true);
    expect(order().customerSnapshot).toMatchObject({
      phone: "0599111222",
      fullName: "Sara",
      email: "s@example.com",
    });
    expect(order().deliverySnapshot).toMatchObject({
      regionId: "inside-1948",
      regionName: { en: "Inside 1948" },
      locationId: "haifa",
      locationName: { en: "Haifa" },
      fullAddress: "Harbor 3",
    });
    expect(order().notes).toBe("After 5pm");
    expect(order().orderNumber).toBe(NUMBER);
    expect([...store.keys()].filter((k) => k.startsWith("orders/"))).toEqual(["orders/o1"]);
  });

  it("rejects a city that is inactive or does not belong to the chosen region", async () => {
    const wrongRegion = await editCustomerOrder(
      db,
      UID,
      input({ regionId: "west-bank", locationId: "haifa" }),
    );
    expect(!wrongRegion.ok && wrongRegion.error.code).toBe("LOCATION_NOT_SUPPORTED");
    store.get("deliveryLocations/haifa")!.isActive = false;
    const inactive = await editCustomerOrder(
      db,
      UID,
      input({ regionId: "inside-1948", locationId: "haifa" }),
    );
    expect(!inactive.ok && inactive.error.code).toBe("LOCATION_NOT_SUPPORTED");
  });

  it("does not require the current city to still be active when it is unchanged", async () => {
    store.get("deliveryLocations/ramallah")!.isActive = false;
    const result = await editCustomerOrder(db, UID, input({ notes: "hello" }));
    expect(result.ok).toBe(true);
  });

  it("validates the delivery fields", () => {
    expect(orderEditSchema.safeParse({ ...input(), phone: "" }).success).toBe(false);
    expect(orderEditSchema.safeParse({ ...input(), fullAddress: "  " }).success).toBe(false);
    expect(orderEditSchema.safeParse({ ...input(), regionId: "mars" }).success).toBe(false);
    expect(orderEditSchema.safeParse({ ...input(), notes: "x".repeat(1001) }).success).toBe(false);
  });
});
