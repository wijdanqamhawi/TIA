import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createTranslator } from "next-intl";
import en from "../../messages/en.json";
import ar from "../../messages/ar.json";

/**
 * The Shop page with `?collection=special-offers`: it reads the SHARED
 * `getSpecialOffers` (ACTIVE offers only — that selection is tested on its own
 * in home-special-offers.test.tsx) instead of the catalogue query, ignores the
 * other filters, and leaves the real category / New Arrivals / price behaviour
 * untouched. The data services are mocked here; nothing touches Firebase.
 */

const listProductsMock = vi.fn();
const getSpecialOffersMock = vi.fn();
const CATEGORIES = [
  { id: "c-bracelets", slug: "bracelets", name: { en: "Bracelets", ar: "أساور" } },
  { id: "c-rings", slug: "rings", name: { en: "Rings", ar: "خواتم" } },
  { id: "c-earrings", slug: "earrings", name: { en: "Earrings", ar: "أقراط" } },
  { id: "c-watches", slug: "watches", name: { en: "Watches", ar: "ساعات" } },
];

vi.mock("@/lib/domain/catalog/category.service", () => ({
  getActiveCategories: async () => CATEGORIES,
}));
vi.mock("@/lib/domain/catalog/product.service", () => ({
  listProducts: (...args: unknown[]) => listProductsMock(...args),
  getSpecialOffers: (...args: unknown[]) => getSpecialOffersMock(...args),
  toProductCardData: (product: unknown) => product,
}));
vi.mock("@/lib/domain/wishlist/wishlist.service", () => ({
  getWishlistedProductIds: async () => new Set<string>(),
}));
vi.mock("@/lib/seo/metadata", () => ({ buildLocalizedMetadata: (x: unknown) => x }));
vi.mock("next-intl/server", () => ({
  getTranslations: async ({ locale, namespace }: { locale: string; namespace: string }) =>
    createTranslator({
      locale,
      messages: (locale === "ar" ? ar : en) as never,
      namespace: namespace as never,
    }),
}));

// The client components are markers that expose the props the page hands them.
type Named = { name: { en: string } };
vi.mock("@/components/storefront/shop/ShopToolbar", () => ({
  ShopToolbar: (p: {
    specialOffersActive?: boolean;
    activeCategoryLabel: string | null;
    resultCount: number;
    hasMore: boolean;
  }) => (
    <div
      data-testid="toolbar"
      data-offers-active={String(Boolean(p.specialOffersActive))}
      data-label={p.activeCategoryLabel ?? ""}
      data-count={p.resultCount}
      data-has-more={String(p.hasMore)}
    />
  ),
}));
vi.mock("@/components/storefront/shop/ShopFilters", () => ({
  ShopFilters: (p: {
    specialOffersActive?: boolean;
    categories: Array<{ slug: string }>;
    activeCategorySlug: string;
  }) => (
    <div
      data-testid="filters"
      data-offers-active={String(Boolean(p.specialOffersActive))}
      data-categories={p.categories.map((c) => c.slug).join(",")}
      data-active-category={p.activeCategorySlug}
    />
  ),
}));
vi.mock("@/components/storefront/shop/ActiveFilterChips", () => ({
  ActiveFilterChips: (p: { chips: Array<{ key: string; label: string }> }) => (
    <ul data-testid="chips">
      {p.chips.map((chip) => (
        <li key={chip.key + chip.label}>{`${chip.key}:${chip.label}`}</li>
      ))}
    </ul>
  ),
}));
vi.mock("@/components/storefront/ProductGridWithLoadMore", () => ({
  ProductGridWithLoadMore: (p: { initialProducts: Named[]; initialCursorId: string | null }) => (
    <ul data-testid="grid" data-cursor={String(p.initialCursorId)}>
      {p.initialProducts.map((product) => (
        <li key={product.name.en}>{product.name.en}</li>
      ))}
    </ul>
  ),
}));

const { default: ShopPage } = await import("@/app/[locale]/(storefront)/shop/page");

const product = (name: string) => ({ id: name, name: { en: name } });
const CATALOGUE = [product("Gold Ring"), product("Sold Watch"), product("Plain Band")];
const ACTIVE_OFFERS = [product("Luna Mesh Watch"), product("Amour Band Ring")];

async function renderShop(searchParams: Record<string, string>, locale: "en" | "ar" = "en") {
  const element = await ShopPage({
    params: Promise.resolve({ locale }),
    searchParams: Promise.resolve(searchParams),
  });
  return render(element);
}

const gridNames = () =>
  Array.from(screen.getByTestId("grid").querySelectorAll("li")).map((li) => li.textContent);

beforeEach(() => {
  listProductsMock.mockReset().mockResolvedValue({ products: CATALOGUE, nextCursorId: "next" });
  getSpecialOffersMock.mockReset().mockResolvedValue(ACTIVE_OFFERS);
});
afterEach(cleanup);

describe("Shop page — ?collection=special-offers", () => {
  it("lists only what the shared getSpecialOffers returns, not the catalogue", async () => {
    await renderShop({ collection: "special-offers" });
    expect(getSpecialOffersMock).toHaveBeenCalledTimes(1);
    expect(listProductsMock).not.toHaveBeenCalled();
    expect(gridNames()).toEqual(["Luna Mesh Watch", "Amour Band Ring"]);
  });

  it("has no paging cursor (every active offer fits one page) and a matching result count", async () => {
    await renderShop({ collection: "special-offers" });
    expect(screen.getByTestId("grid").getAttribute("data-cursor")).toBe("null");
    expect(screen.getByTestId("toolbar").getAttribute("data-has-more")).toBe("false");
    expect(screen.getByTestId("toolbar").getAttribute("data-count")).toBe("2");
  });

  it("shows the Special Offers heading, removable chip and selected state in the filter and drawer", async () => {
    await renderShop({ collection: "special-offers" });
    expect(screen.getByRole("heading", { level: 1, name: "Special Offers" })).toBeTruthy();
    expect(screen.getByTestId("chips").textContent).toBe("collection:Special Offers");
    expect(screen.getByTestId("filters").getAttribute("data-offers-active")).toBe("true");
    expect(screen.getByTestId("toolbar").getAttribute("data-offers-active")).toBe("true");
    expect(screen.getByTestId("toolbar").getAttribute("data-label")).toBe("Special Offers");
  });

  it("is exclusive: a category, search or price in the same URL does not reach the catalogue query", async () => {
    await renderShop({
      collection: "special-offers",
      category: "rings",
      q: "gold",
      min: "10000",
      sort: "price",
    });
    expect(listProductsMock).not.toHaveBeenCalled();
    expect(getSpecialOffersMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("filters").getAttribute("data-active-category")).toBe("");
  });

  it("never turns Special Offers into a category: the filter is handed the four real categories only", async () => {
    await renderShop({ collection: "special-offers" });
    expect(screen.getByTestId("filters").getAttribute("data-categories")).toBe(
      "bracelets,rings,earrings,watches",
    );
  });

  it("shows an empty grid (the Shop's own empty state) when no offer is active — never other products", async () => {
    getSpecialOffersMock.mockResolvedValue([]);
    await renderShop({ collection: "special-offers" });
    expect(gridNames()).toEqual([]);
  });

  it("is titled العروض الخاصة in Arabic", async () => {
    await renderShop({ collection: "special-offers" }, "ar");
    expect(screen.getByRole("heading", { level: 1, name: "العروض الخاصة" })).toBeTruthy();
    expect(screen.getByTestId("chips").textContent).toBe("collection:العروض الخاصة");
  });
});

describe("Shop page — the existing filters are unchanged", () => {
  it("a bare /shop is the whole catalogue, with Special Offers off", async () => {
    await renderShop({});
    expect(listProductsMock).toHaveBeenCalledTimes(1);
    expect(listProductsMock.mock.calls[0]![0]).toMatchObject({ pageSize: 12, sort: "newest" });
    expect(listProductsMock.mock.calls[0]![0].categoryId).toBeUndefined();
    expect(getSpecialOffersMock).not.toHaveBeenCalled();
    expect(gridNames()).toEqual(["Gold Ring", "Sold Watch", "Plain Band"]);
    expect(screen.getByTestId("grid").getAttribute("data-cursor")).toBe("next");
    expect(screen.getByTestId("filters").getAttribute("data-offers-active")).toBe("false");
    expect(screen.getByRole("heading", { level: 1, name: en.Shop.allTitle })).toBeTruthy();
  });

  it("?category=rings still filters by that real category", async () => {
    await renderShop({ category: "rings" });
    expect(listProductsMock.mock.calls[0]![0]).toMatchObject({ categoryId: "c-rings" });
    expect(getSpecialOffersMock).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { level: 1, name: "Rings" })).toBeTruthy();
    expect(screen.getByTestId("filters").getAttribute("data-active-category")).toBe("rings");
    expect(screen.getByTestId("filters").getAttribute("data-offers-active")).toBe("false");
    expect(screen.getByTestId("chips").textContent).toBe("category:Rings");
  });

  it("price, search and sort still reach the catalogue query", async () => {
    await renderShop({ category: "watches", min: "10000", max: "20000", sort: "price" });
    expect(listProductsMock.mock.calls[0]![0]).toMatchObject({
      categoryId: "c-watches",
      minPrice: 10000,
      maxPrice: 20000,
      sort: "price",
    });
  });

  it("New Arrivals is still its own scope, and does not use the offers selection", async () => {
    await renderShop({ collection: "new-arrivals" });
    expect(listProductsMock.mock.calls[0]![0]).toMatchObject({ isNewArrival: true });
    expect(getSpecialOffersMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("filters").getAttribute("data-offers-active")).toBe("false");
    expect(screen.getByRole("heading", { level: 1, name: "New Arrivals" })).toBeTruthy();
  });

  it("an unknown collection falls back to the whole catalogue", async () => {
    await renderShop({ collection: "winter-2099" });
    expect(listProductsMock).toHaveBeenCalledTimes(1);
    expect(getSpecialOffersMock).not.toHaveBeenCalled();
  });
});

describe("one offer selection, not two", () => {
  it("the Shop page reuses getSpecialOffers and does not re-implement offer status or write categories", () => {
    const page = readFileSync(
      resolve(process.cwd(), "src/app/[locale]/(storefront)/shop/page.tsx"),
      "utf8",
    );
    expect(page).toMatch(/getSpecialOffers/);
    expect(page).not.toMatch(/getOfferStatus|resolveOfferPricing|isOnSale|saleEndAt|saleStartAt/);
    expect(page).not.toMatch(/categoriesCollection|categoryCollection|\.set\(|\.add\(|\.update\(/);
  });
});
