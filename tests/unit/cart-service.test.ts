import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Product } from "@/types/product";
import type { Cart, CartItem } from "@/types/cart";

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    name: { en: "Gold Ring", ar: null },
    slug: "gold-ring",
    description: { en: "d", ar: null },
    price: 10000,
    categoryId: "rings",
    images: [{ url: "https://example.com/a.jpg", storagePath: "a.jpg", position: 0, alt: "Gold Ring" }],
    material: { en: "Gold", ar: null },
    options: [],
    stock: 5,
    availability: true,
    isNewArrival: false,
    isBestSeller: false,
    salesCount: 0,
    searchTerms: [],
    isOnSale: false,
    salePrice: null,
    saleStartAt: null,
    saleEndAt: null,
    // @ts-expect-error -- Timestamp not needed for these pure unit tests
    createdAt: null,
    // @ts-expect-error -- Timestamp not needed for these pure unit tests
    updatedAt: null,
    ...overrides,
  };
}

function makeCart(items: CartItem[]): Cart {
  return {
    id: "u1",
    items,
    expiresAt: null,
    // @ts-expect-error -- Timestamp not needed for these pure unit tests
    createdAt: null,
    // @ts-expect-error -- Timestamp not needed for these pure unit tests
    updatedAt: null,
  };
}

vi.mock("@/lib/firebase/guards", () => ({ getSessionClaims: vi.fn().mockResolvedValue(null) }));

const getProductsByIdsMock = vi.fn();
const isSelectedOptionValidMock = vi.fn();
const validateCartLineAvailabilityMock = vi.fn();

vi.mock("@/lib/domain/catalog/product.service", () => ({
  getProductsByIds: (...args: unknown[]) => getProductsByIdsMock(...args),
  isSelectedOptionValid: (...args: unknown[]) => isSelectedOptionValidMock(...args),
  validateCartLineAvailability: (...args: unknown[]) => validateCartLineAvailabilityMock(...args),
}));

const { sameCartLine, buildCartSummary } = await import("@/lib/domain/cart/cart.service");
const { computeMergedCartItems } = await import("@/lib/domain/cart/cart-merge.service");

describe("sameCartLine", () => {
  it("matches identical productId with no option", () => {
    expect(sameCartLine({ productId: "p1", selectedOption: null }, { productId: "p1", selectedOption: null })).toBe(
      true,
    );
  });

  it("does not match different productId", () => {
    expect(sameCartLine({ productId: "p1", selectedOption: null }, { productId: "p2", selectedOption: null })).toBe(
      false,
    );
  });

  it("distinguishes different selectedOption values on the same product", () => {
    const gold = { productId: "p1", selectedOption: { optionKey: "color", valueKey: "gold" } };
    const silver = { productId: "p1", selectedOption: { optionKey: "color", valueKey: "silver" } };
    expect(sameCartLine(gold, silver)).toBe(false);
    expect(sameCartLine(gold, { ...gold })).toBe(true);
  });
});

describe("buildCartSummary — server-side subtotal/total (T102)", () => {
  beforeEach(() => {
    getProductsByIdsMock.mockReset();
    isSelectedOptionValidMock.mockReset().mockReturnValue(true);
    validateCartLineAvailabilityMock.mockReset().mockReturnValue({ ok: true });
  });

  it("sums lineTotal across valid lines only, using live product price", async () => {
    const product = makeProduct({ id: "p1", price: 10000, stock: 5 });
    getProductsByIdsMock.mockResolvedValue(new Map([["p1", product]]));

    const summary = await buildCartSummary(makeCart([{ productId: "p1", selectedOption: null, quantity: 2 }]));

    expect(summary.subtotal).toBe(20000);
    expect(summary.total).toBe(20000);
    expect(summary.hasIssues).toBe(false);
    expect(summary.isEmpty).toBe(false);
  });

  it("excludes a Sold Out line from the total and flags it as an issue", async () => {
    const product = makeProduct({ id: "p1", price: 10000, stock: 0 });
    getProductsByIdsMock.mockResolvedValue(new Map([["p1", product]]));
    validateCartLineAvailabilityMock.mockReturnValue({ ok: false, reason: "SOLD_OUT" });

    const summary = await buildCartSummary(makeCart([{ productId: "p1", selectedOption: null, quantity: 1 }]));

    expect(summary.subtotal).toBe(0);
    expect(summary.hasIssues).toBe(true);
    expect(summary.lines[0].issue).toBe("SOLD_OUT");
  });

  it("flags a line whose product was deleted as NOT_FOUND, excluded from the total", async () => {
    getProductsByIdsMock.mockResolvedValue(new Map());

    const summary = await buildCartSummary(
      makeCart([{ productId: "deleted-product", selectedOption: null, quantity: 1 }]),
    );

    expect(summary.lines[0].issue).toBe("NOT_FOUND");
    expect(summary.subtotal).toBe(0);
  });

  it("flags an invalid/removed option without touching stock validation", async () => {
    const product = makeProduct({ id: "p1", price: 10000, stock: 5 });
    getProductsByIdsMock.mockResolvedValue(new Map([["p1", product]]));
    isSelectedOptionValidMock.mockReturnValue(false);

    const summary = await buildCartSummary(
      makeCart([{ productId: "p1", selectedOption: { optionKey: "color", valueKey: "gone" }, quantity: 1 }]),
    );

    expect(summary.lines[0].issue).toBe("INVALID_OPTION");
    expect(summary.subtotal).toBe(0);
  });

  it("returns an empty summary for an empty cart", async () => {
    getProductsByIdsMock.mockResolvedValue(new Map());
    const summary = await buildCartSummary(makeCart([]));
    expect(summary.isEmpty).toBe(true);
    expect(summary.subtotal).toBe(0);
    expect(summary.hasIssues).toBe(false);
  });
});

describe("buildCartSummary — Special Offers pricing (T325, spec FR-119/FR-120, SC-029)", () => {
  beforeEach(() => {
    getProductsByIdsMock.mockReset();
    isSelectedOptionValidMock.mockReset().mockReturnValue(true);
    validateCartLineAvailabilityMock.mockReset().mockReturnValue({ ok: true });
  });

  it("prices a line at the active sale price, not the regular price", async () => {
    const product = makeProduct({ id: "p1", price: 10000, isOnSale: true, salePrice: 8000 });
    getProductsByIdsMock.mockResolvedValue(new Map([["p1", product]]));

    const summary = await buildCartSummary(makeCart([{ productId: "p1", selectedOption: null, quantity: 2 }]));

    expect(summary.subtotal).toBe(16000);
    expect(summary.lines[0].product?.price).toBe(8000);
    expect(summary.lines[0].product?.originalPrice).toBe(10000);
    expect(summary.lines[0].product?.offerStatus).toBe("ACTIVE");
  });

  it("prices a line at the regular price when the offer is disabled", async () => {
    const product = makeProduct({ id: "p1", price: 10000, isOnSale: false, salePrice: null });
    getProductsByIdsMock.mockResolvedValue(new Map([["p1", product]]));

    const summary = await buildCartSummary(makeCart([{ productId: "p1", selectedOption: null, quantity: 1 }]));

    expect(summary.subtotal).toBe(10000);
    expect(summary.lines[0].product?.price).toBe(10000);
    expect(summary.lines[0].product?.offerStatus).toBe("DISABLED");
  });

  it("prices a line at the regular price when the offer is scheduled in the future", async () => {
    const future = { toMillis: () => Date.now() + 60_000 } as unknown as Product["saleStartAt"];
    const product = makeProduct({ id: "p1", price: 10000, isOnSale: true, salePrice: 8000, saleStartAt: future });
    getProductsByIdsMock.mockResolvedValue(new Map([["p1", product]]));

    const summary = await buildCartSummary(makeCart([{ productId: "p1", selectedOption: null, quantity: 1 }]));

    expect(summary.lines[0].product?.price).toBe(10000);
    expect(summary.lines[0].product?.offerStatus).toBe("SCHEDULED");
  });

  it("a Sold Out product is excluded from the total regardless of an active offer (spec FR-122)", async () => {
    const product = makeProduct({ id: "p1", price: 10000, stock: 0, isOnSale: true, salePrice: 8000 });
    getProductsByIdsMock.mockResolvedValue(new Map([["p1", product]]));
    validateCartLineAvailabilityMock.mockReturnValue({ ok: false, reason: "SOLD_OUT" });

    const summary = await buildCartSummary(makeCart([{ productId: "p1", selectedOption: null, quantity: 1 }]));

    expect(summary.subtotal).toBe(0);
    expect(summary.lines[0].issue).toBe("SOLD_OUT");
  });
});

describe("computeMergedCartItems — stock-clamped guest→registered merge (T103/T107)", () => {
  it("sums quantities for a duplicate productId + selectedOption combination", () => {
    const userItems: CartItem[] = [{ productId: "p1", selectedOption: null, quantity: 2 }];
    const guestItems: CartItem[] = [{ productId: "p1", selectedOption: null, quantity: 3 }];
    expect(computeMergedCartItems(userItems, guestItems, new Map([["p1", 100]]))).toEqual([
      { productId: "p1", selectedOption: null, quantity: 5 },
    ]);
  });

  it("clamps the merged quantity to current stock — never exceeds it", () => {
    const userItems: CartItem[] = [{ productId: "p1", selectedOption: null, quantity: 2 }];
    const guestItems: CartItem[] = [{ productId: "p1", selectedOption: null, quantity: 3 }];
    expect(computeMergedCartItems(userItems, guestItems, new Map([["p1", 4]]))).toEqual([
      { productId: "p1", selectedOption: null, quantity: 4 },
    ]);
  });

  it("keeps different selectedOption values on the same product as separate lines", () => {
    const userItems: CartItem[] = [
      { productId: "p1", selectedOption: { optionKey: "color", valueKey: "gold" }, quantity: 1 },
    ];
    const guestItems: CartItem[] = [
      { productId: "p1", selectedOption: { optionKey: "color", valueKey: "silver" }, quantity: 1 },
    ];
    expect(computeMergedCartItems(userItems, guestItems, new Map([["p1", 10]]))).toHaveLength(2);
  });

  it("drops a guest line whose product no longer exists", () => {
    const result = computeMergedCartItems(
      [],
      [{ productId: "deleted", selectedOption: null, quantity: 2 }],
      new Map(),
    );
    expect(result).toEqual([]);
  });

  it("adds a new guest line clamped to stock when the user cart doesn't already have it", () => {
    const result = computeMergedCartItems(
      [],
      [{ productId: "p1", selectedOption: null, quantity: 10 }],
      new Map([["p1", 3]]),
    );
    expect(result).toEqual([{ productId: "p1", selectedOption: null, quantity: 3 }]);
  });

  it("leaves pre-existing user-only lines untouched", () => {
    const userItems: CartItem[] = [{ productId: "p2", selectedOption: null, quantity: 7 }];
    expect(computeMergedCartItems(userItems, [], new Map())).toEqual(userItems);
  });

  it("removes a line entirely when clamped quantity would be 0 or less", () => {
    const userItems: CartItem[] = [{ productId: "p1", selectedOption: null, quantity: 2 }];
    const guestItems: CartItem[] = [{ productId: "p1", selectedOption: null, quantity: 1 }];
    // Product now completely out of stock (0) — the combined line is dropped, not left at a
    // stale positive quantity.
    expect(computeMergedCartItems(userItems, guestItems, new Map([["p1", 0]]))).toEqual([]);
  });
});
