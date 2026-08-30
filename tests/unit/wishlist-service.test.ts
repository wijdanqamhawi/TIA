import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Product } from "@/types/product";
import type { WishlistItem } from "@/types/wishlist";

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

function makeWishlistItem(overrides: Partial<WishlistItem> = {}): WishlistItem {
  return {
    productId: "p1",
    selectedOption: null,
    // @ts-expect-error -- toMillis-only fake Timestamp is enough for sort-order tests
    addedAt: { toMillis: () => 1000 },
    ...overrides,
  };
}

vi.mock("@/lib/firebase/guards", () => ({ getSessionClaims: vi.fn().mockResolvedValue(null) }));

const getProductsByIdsMock = vi.fn();
const isSelectedOptionValidMock = vi.fn();

vi.mock("@/lib/domain/catalog/product.service", () => ({
  getProductsByIds: (...args: unknown[]) => getProductsByIdsMock(...args),
  isSelectedOptionValid: (...args: unknown[]) => isSelectedOptionValidMock(...args),
}));

const { sameWishlistItem, buildWishlistSummary } = await import("@/lib/domain/wishlist/wishlist.service");

describe("sameWishlistItem", () => {
  it("matches identical productId with no option", () => {
    expect(sameWishlistItem({ productId: "p1", selectedOption: null }, { productId: "p1", selectedOption: null })).toBe(
      true,
    );
  });

  it("does not match different productId", () => {
    expect(sameWishlistItem({ productId: "p1", selectedOption: null }, { productId: "p2", selectedOption: null })).toBe(
      false,
    );
  });

  it("distinguishes different selectedOption values on the same product", () => {
    const gold = { productId: "p1", selectedOption: { optionKey: "color", valueKey: "gold" } };
    const silver = { productId: "p1", selectedOption: { optionKey: "color", valueKey: "silver" } };
    expect(sameWishlistItem(gold, silver)).toBe(false);
    expect(sameWishlistItem(gold, { ...gold })).toBe(true);
  });
});

describe("buildWishlistSummary — live enrichment, never a stored price/stock (spec FR-032)", () => {
  beforeEach(() => {
    getProductsByIdsMock.mockReset();
    isSelectedOptionValidMock.mockReset().mockReturnValue(true);
  });

  it("enriches an entry with the product's current live price/stock/availability", async () => {
    const product = makeProduct({ id: "p1", price: 10000, stock: 3 });
    getProductsByIdsMock.mockResolvedValue(new Map([["p1", product]]));

    const summary = await buildWishlistSummary({
      id: "u1",
      items: [makeWishlistItem({ productId: "p1" })],
      // @ts-expect-error -- Timestamp not needed
      createdAt: null,
      // @ts-expect-error -- Timestamp not needed
      updatedAt: null,
    });

    expect(summary.isEmpty).toBe(false);
    expect(summary.items[0].product).toMatchObject({ price: 10000, stock: 3, isSoldOut: false });
    expect(summary.items[0].issue).toBeNull();
  });

  it("flags a Sold Out product but still returns its full product info (never dropped)", async () => {
    const product = makeProduct({ id: "p1", stock: 0 });
    getProductsByIdsMock.mockResolvedValue(new Map([["p1", product]]));

    const summary = await buildWishlistSummary({
      id: "u1",
      items: [makeWishlistItem({ productId: "p1" })],
      // @ts-expect-error -- Timestamp not needed
      createdAt: null,
      // @ts-expect-error -- Timestamp not needed
      updatedAt: null,
    });

    expect(summary.items[0].issue).toBeNull();
    expect(summary.items[0].product?.isSoldOut).toBe(true);
  });

  it("prices an entry at the active sale price via resolveOfferPricing", async () => {
    const product = makeProduct({ id: "p1", price: 10000, isOnSale: true, salePrice: 7500 });
    getProductsByIdsMock.mockResolvedValue(new Map([["p1", product]]));

    const summary = await buildWishlistSummary({
      id: "u1",
      items: [makeWishlistItem({ productId: "p1" })],
      // @ts-expect-error -- Timestamp not needed
      createdAt: null,
      // @ts-expect-error -- Timestamp not needed
      updatedAt: null,
    });

    expect(summary.items[0].product?.price).toBe(7500);
    expect(summary.items[0].product?.originalPrice).toBe(10000);
    expect(summary.items[0].product?.offerStatus).toBe("ACTIVE");
  });

  it("flags a deleted product as NOT_FOUND without dropping the entry", async () => {
    getProductsByIdsMock.mockResolvedValue(new Map());

    const summary = await buildWishlistSummary({
      id: "u1",
      items: [makeWishlistItem({ productId: "deleted" })],
      // @ts-expect-error -- Timestamp not needed
      createdAt: null,
      // @ts-expect-error -- Timestamp not needed
      updatedAt: null,
    });

    expect(summary.items[0].issue).toBe("NOT_FOUND");
    expect(summary.items[0].product).toBeNull();
  });

  it("flags a no-longer-valid selected option as INVALID_OPTION", async () => {
    const product = makeProduct({ id: "p1" });
    getProductsByIdsMock.mockResolvedValue(new Map([["p1", product]]));
    isSelectedOptionValidMock.mockReturnValue(false);

    const summary = await buildWishlistSummary({
      id: "u1",
      items: [makeWishlistItem({ productId: "p1", selectedOption: { optionKey: "color", valueKey: "gone" } })],
      // @ts-expect-error -- Timestamp not needed
      createdAt: null,
      // @ts-expect-error -- Timestamp not needed
      updatedAt: null,
    });

    expect(summary.items[0].issue).toBe("INVALID_OPTION");
  });

  it("orders items newest-added first", async () => {
    getProductsByIdsMock.mockResolvedValue(
      new Map([
        ["old", makeProduct({ id: "old" })],
        ["new", makeProduct({ id: "new" })],
      ]),
    );

    const summary = await buildWishlistSummary({
      id: "u1",
      items: [
        makeWishlistItem({ productId: "old", addedAt: { toMillis: () => 1000 } as never }),
        makeWishlistItem({ productId: "new", addedAt: { toMillis: () => 2000 } as never }),
      ],
      // @ts-expect-error -- Timestamp not needed
      createdAt: null,
      // @ts-expect-error -- Timestamp not needed
      updatedAt: null,
    });

    expect(summary.items.map((i) => i.productId)).toEqual(["new", "old"]);
  });

  it("returns an empty summary for an empty wishlist", async () => {
    getProductsByIdsMock.mockResolvedValue(new Map());
    const summary = await buildWishlistSummary({
      id: "u1",
      items: [],
      // @ts-expect-error -- Timestamp not needed
      createdAt: null,
      // @ts-expect-error -- Timestamp not needed
      updatedAt: null,
    });
    expect(summary.isEmpty).toBe(true);
  });
});
