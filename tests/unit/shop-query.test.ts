import { describe, expect, it } from "vitest";
import {
  buildShopHref,
  parseShopQuery,
  NEW_ARRIVALS_COLLECTION,
} from "@/components/storefront/shop/shopQuery";

describe("parseShopQuery — New Arrivals collection scope", () => {
  it("is off by default, so a bare /shop is still the whole catalogue", () => {
    expect(parseShopQuery({}).isNewArrivals).toBe(false);
    expect(parseShopQuery({ sort: "newest" }).isNewArrivals).toBe(false);
  });

  it("turns on for ?collection=new-arrivals", () => {
    expect(parseShopQuery({ collection: NEW_ARRIVALS_COLLECTION }).isNewArrivals).toBe(true);
    expect(parseShopQuery({ collection: ` ${NEW_ARRIVALS_COLLECTION} ` }).isNewArrivals).toBe(true);
  });

  it("ignores an unknown collection rather than emptying the catalogue", () => {
    expect(parseShopQuery({ collection: "winter-2099" }).isNewArrivals).toBe(false);
  });

  it("is exclusive: no un-indexed category/price/search/sort combination reaches the query", () => {
    const query = parseShopQuery({
      collection: NEW_ARRIVALS_COLLECTION,
      category: "rings",
      q: "gold",
      min: "10000",
      max: "20000",
      sort: "price",
    });
    expect(query).toMatchObject({
      isNewArrivals: true,
      categorySlug: "",
      search: "",
      sort: "newest",
      minPrice: undefined,
      maxPrice: undefined,
    });
  });
});

describe("buildShopHref — the collection scope in the URL", () => {
  it("keeps the collection when nothing else changes", () => {
    expect(buildShopHref("/shop", { collection: NEW_ARRIVALS_COLLECTION }, {})).toBe(
      "/shop?collection=new-arrivals",
    );
  });

  it("clears the collection when its own chip is removed", () => {
    expect(
      buildShopHref("/shop", { collection: NEW_ARRIVALS_COLLECTION }, { collection: undefined }),
    ).toBe("/shop");
  });

  it("leaves the collection as soon as any ordinary filter changes", () => {
    const current = { collection: NEW_ARRIVALS_COLLECTION };
    expect(buildShopHref("/shop", current, { category: "rings" })).toBe("/shop?category=rings");
    expect(buildShopHref("/shop", current, { sort: "price" })).toBe("/shop?sort=price");
    expect(buildShopHref("/shop", current, { q: "gold" })).toBe("/shop?q=gold");
    expect(buildShopHref("/shop", current, { min: "10000" })).toBe("/shop?min=10000");
  });

  it("still drops the default sort and empty values for an ordinary Shop URL", () => {
    expect(buildShopHref("/shop", {}, { sort: "newest" })).toBe("/shop");
  });
});
