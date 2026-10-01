import { describe, expect, it } from "vitest";
import {
  buildShopHref,
  parseShopQuery,
  NEW_ARRIVALS_COLLECTION,
  SPECIAL_OFFERS_COLLECTION,
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

describe("parseShopQuery — Special Offers collection scope", () => {
  it("is off by default and for New Arrivals, so the catalogue and New Arrivals are unchanged", () => {
    expect(parseShopQuery({}).isSpecialOffers).toBe(false);
    expect(parseShopQuery({ category: "rings" }).isSpecialOffers).toBe(false);
    expect(parseShopQuery({ collection: NEW_ARRIVALS_COLLECTION })).toMatchObject({
      isNewArrivals: true,
      isSpecialOffers: false,
    });
  });

  it("turns on for ?collection=special-offers (and only that), and is not a category", () => {
    expect(SPECIAL_OFFERS_COLLECTION).toBe("special-offers");
    expect(parseShopQuery({ collection: SPECIAL_OFFERS_COLLECTION })).toMatchObject({
      isSpecialOffers: true,
      isNewArrivals: false,
      categorySlug: "",
    });
    expect(parseShopQuery({ collection: ` ${SPECIAL_OFFERS_COLLECTION} ` }).isSpecialOffers).toBe(
      true,
    );
    expect(parseShopQuery({ collection: "sale" }).isSpecialOffers).toBe(false);
    // `special-offers` in the *category* slot is just an unknown category slug, never the offers scope.
    expect(parseShopQuery({ category: "special-offers" })).toMatchObject({
      isSpecialOffers: false,
      categorySlug: "special-offers",
    });
  });

  it("is exclusive: category, search, price and sort are read as absent", () => {
    expect(
      parseShopQuery({
        collection: SPECIAL_OFFERS_COLLECTION,
        category: "rings",
        q: "gold",
        min: "10000",
        max: "20000",
        sort: "price",
      }),
    ).toMatchObject({
      isSpecialOffers: true,
      categorySlug: "",
      search: "",
      sort: "newest",
      minPrice: undefined,
      maxPrice: undefined,
      priceDisabled: false,
    });
  });
});

describe("buildShopHref — Special Offers in the URL", () => {
  const offers = { collection: SPECIAL_OFFERS_COLLECTION };

  it("keeps the scope when nothing else changes, and clears it with its own chip", () => {
    expect(buildShopHref("/shop", offers, {})).toBe("/shop?collection=special-offers");
    expect(buildShopHref("/shop", offers, { collection: undefined })).toBe("/shop");
  });

  it("choosing a real category, sort, search or price leaves the scope — the category filters still work", () => {
    expect(buildShopHref("/shop", offers, { category: "rings" })).toBe("/shop?category=rings");
    expect(buildShopHref("/shop", offers, { category: "watches" })).toBe("/shop?category=watches");
    expect(buildShopHref("/shop", offers, { sort: "price" })).toBe("/shop?sort=price");
    expect(buildShopHref("/shop", offers, { q: "gold" })).toBe("/shop?q=gold");
    expect(buildShopHref("/shop", offers, { min: "10000" })).toBe("/shop?min=10000");
  });

  it("entering the scope from a clean state produces a clean URL", () => {
    expect(buildShopHref("/shop", {}, { collection: SPECIAL_OFFERS_COLLECTION })).toBe(
      "/shop?collection=special-offers",
    );
  });
});
