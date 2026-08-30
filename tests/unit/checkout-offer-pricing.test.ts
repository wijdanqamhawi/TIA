import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit-tests `resolveOrderLinePrices` (T326 prep primitive,
 * `checkout.service.ts`) against a fake Firestore doc reference — proves it
 * resolves each line's authoritative *effective* price (regular or active
 * sale price) from the read product, never a client-submitted value,
 * ahead of Phase 8's full order-creation transaction reusing this same
 * logic inside `transaction.get()` reads.
 */

function makeProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1",
    price: 10000,
    isOnSale: false,
    salePrice: null,
    saleStartAt: null,
    saleEndAt: null,
    ...overrides,
  };
}

const docs = new Map<string, ReturnType<typeof makeProduct>>();

vi.mock("@/lib/firebase/firestore", () => ({
  productsCollection: () => ({
    doc: (id: string) => ({
      get: async () => {
        const data = docs.get(id);
        return { exists: Boolean(data), data: () => data };
      },
    }),
  }),
}));

const { resolveOrderLinePrices } = await import("@/lib/domain/checkout/checkout.service");

describe("resolveOrderLinePrices (T326 prep, spec FR-119/FR-121)", () => {
  beforeEach(() => {
    docs.clear();
  });

  it("prices a line at the regular price when no offer is active", async () => {
    docs.set("p1", makeProduct({ price: 10000 }));
    const result = await resolveOrderLinePrices([{ productId: "p1", quantity: 2 }]);
    expect(result).toEqual([{ productId: "p1", quantity: 2, unitPrice: 10000 }]);
  });

  it("prices a line at the active sale price", async () => {
    docs.set("p1", makeProduct({ price: 10000, isOnSale: true, salePrice: 7500 }));
    const result = await resolveOrderLinePrices([{ productId: "p1", quantity: 1 }]);
    expect(result).toEqual([{ productId: "p1", quantity: 1, unitPrice: 7500 }]);
  });

  it("prices a line at the regular price when the offer is scheduled in the future", async () => {
    const future = { toMillis: () => Date.now() + 60_000 };
    docs.set("p1", makeProduct({ price: 10000, isOnSale: true, salePrice: 7500, saleStartAt: future }));
    const result = await resolveOrderLinePrices([{ productId: "p1", quantity: 1 }]);
    expect(result).toEqual([{ productId: "p1", quantity: 1, unitPrice: 10000 }]);
  });

  it("prices a line at the regular price when the offer has expired", async () => {
    const past = { toMillis: () => Date.now() - 60_000 };
    docs.set("p1", makeProduct({ price: 10000, isOnSale: true, salePrice: 7500, saleEndAt: past }));
    const result = await resolveOrderLinePrices([{ productId: "p1", quantity: 1 }]);
    expect(result).toEqual([{ productId: "p1", quantity: 1, unitPrice: 10000 }]);
  });

  it("skips a line whose product no longer exists", async () => {
    const result = await resolveOrderLinePrices([{ productId: "missing", quantity: 1 }]);
    expect(result).toEqual([]);
  });
});
