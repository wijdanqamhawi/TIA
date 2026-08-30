import { describe, expect, it } from "vitest";
import { buildWishlistIntent, parseWishlistIntent } from "@/lib/domain/wishlist/wishlist-intent";

describe("buildWishlistIntent / parseWishlistIntent (T113/T114, spec FR-033a, research.md §7)", () => {
  it("round-trips a productId with no selected option", () => {
    const intent = buildWishlistIntent("p1", null);
    expect(intent).toBe("wishlist:p1");
    expect(parseWishlistIntent(intent)).toEqual({ productId: "p1", selectedOption: null });
  });

  it("round-trips a productId with a selected option", () => {
    const selectedOption = { optionKey: "color", valueKey: "gold" };
    const intent = buildWishlistIntent("p1", selectedOption);
    expect(intent).toBe("wishlist:p1:color:gold");
    expect(parseWishlistIntent(intent)).toEqual({ productId: "p1", selectedOption });
  });

  it("returns null for a missing intent", () => {
    expect(parseWishlistIntent(undefined)).toBeNull();
    expect(parseWishlistIntent(null)).toBeNull();
    expect(parseWishlistIntent("")).toBeNull();
  });

  it("returns null for a malformed intent", () => {
    expect(parseWishlistIntent("not-a-wishlist-intent")).toBeNull();
    expect(parseWishlistIntent("cart:p1")).toBeNull();
    expect(parseWishlistIntent("wishlist:")).toBeNull();
    expect(parseWishlistIntent("wishlist:p1:onlyOnePart")).toBeNull();
  });

  it("rejects an intent containing characters outside the stable-identifier charset", () => {
    expect(parseWishlistIntent("wishlist:p1;DROP TABLE")).toBeNull();
    expect(parseWishlistIntent("wishlist:p1/../etc")).toBeNull();
  });

  it("accepts stable identifiers containing letters, numbers, hyphens, and underscores", () => {
    const intent = buildWishlistIntent("prod_123-ABC", { optionKey: "opt-1", valueKey: "val_2" });
    expect(parseWishlistIntent(intent)).toEqual({
      productId: "prod_123-ABC",
      selectedOption: { optionKey: "opt-1", valueKey: "val_2" },
    });
  });
});
