import type { ProductSort } from "@/lib/domain/catalog/product.service";

/** The three sorts `listProducts` supports. */
export const VALID_SORTS: ProductSort[] = ["newest", "price", "popularity"];

/**
 * The price bands offered in the sidebar, in minor units.
 *
 * These are presentation bands over the real `minPrice`/`maxPrice` filter —
 * not catalogue data. They are deliberately round numbers in the store's own
 * currency rather than the reference mockup's SAR figures, which were
 * invented for the design.
 */
export const PRICE_BANDS = [
  { id: "under-100", min: undefined as number | undefined, max: 10000 as number | undefined, labelKey: "priceUnder" },
  { id: "100-200", min: 10000 as number | undefined, max: 20000 as number | undefined, labelKey: "priceBetween" },
  { id: "200-300", min: 20000 as number | undefined, max: 30000 as number | undefined, labelKey: "priceBetween" },
  { id: "above-300", min: 30000 as number | undefined, max: undefined as number | undefined, labelKey: "priceAbove" },
] as const;

/**
 * The one collection scope the Shop route understands: New Arrivals.
 *
 * Collections are derived queries over a `Product` flag (data-model.md
 * "Collection"), not a curated membership list, so New Arrivals needs no route
 * of its own — it is the Shop listing scoped by `isNewArrival == true`, which
 * is exactly what `getNewArrivals` does for the homepage row.
 */
export const NEW_ARRIVALS_COLLECTION = "new-arrivals";

/** The raw query string this page reads. */
export type ShopSearchParams = {
  q?: string;
  sort?: string;
  category?: string;
  min?: string;
  max?: string;
  /** Collection scope — currently only `NEW_ARRIVALS_COLLECTION`. */
  collection?: string;
};

export type ShopQuery = {
  search: string;
  sort: ProductSort;
  /** Category *slug* — the language-independent identifier already used in URLs. */
  categorySlug: string;
  minPrice?: number;
  maxPrice?: number;
  /** True while the listing is scoped to the New Arrivals collection. */
  isNewArrivals: boolean;
};

/**
 * Reads a `min`/`max` query value, which is already in **minor units**.
 *
 * ── WHY NO ×100 HERE ───────────────────────────────────────────
 * `PRICE_BANDS` above are declared in minor units (10000 = $100), the
 * sidebar writes `String(band.min)` straight into the URL, `formatCurrency`
 * reads them back as minor units, and `listProducts` compares them against
 * `price`, also minor units. This function used to scale the value by 100 as
 * if the URL carried major units, so the "$100 – $200" band asked Firestore
 * for products between $10,000 and $20,000 and every price band returned an
 * empty catalogue — on its own and in combination with a category.
 *
 * Minor units are integers by definition, so a fractional value is floored
 * rather than silently scaled.
 */
function parsePrice(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const asNumber = Number(value);
  if (!Number.isFinite(asNumber) || asNumber < 0) return undefined;
  return Math.round(asNumber);
}

/**
 * Normalizes the Shop/category query string into the shape the listing
 * query understands.
 *
 * ── ONE REAL CONSTRAINT, SURFACED HERE ───────────────────────────────────
 * `listProducts` cannot combine a keyword search with a price range: the
 * `array-contains-any` search filter and an inequality range on `price`
 * cannot share a composite index, so when a search is active the service
 * *ignores* `minPrice`/`maxPrice` (and falls back to document order rather
 * than the requested sort). Rather than let the UI quietly promise a filter
 * the query will drop, `priceDisabled` is derived once here and the price
 * controls disable themselves against it.
 */
export function parseShopQuery(sp: ShopSearchParams): ShopQuery & { priceDisabled: boolean } {
  // ── THE COLLECTION SCOPE IS EXCLUSIVE ──────────────────────────────────
  // `isNewArrival` is indexed only as `isNewArrival ASC, availability ASC,
  // createdAt DESC`; there is no composite index pairing it with a category,
  // a price range, a search or another sort. Rather than issue a query
  // Firestore would reject, the collection scope simply wins and the other
  // filters are read as absent — and `buildShopHref` below drops `collection`
  // as soon as the shopper touches any of them, so the two can never disagree.
  const isNewArrivals = sp.collection?.trim() === NEW_ARRIVALS_COLLECTION;
  if (isNewArrivals) {
    return {
      search: "",
      sort: "newest",
      categorySlug: "",
      minPrice: undefined,
      maxPrice: undefined,
      isNewArrivals: true,
      priceDisabled: false,
    };
  }

  const search = sp.q?.trim() ?? "";
  const sort: ProductSort = VALID_SORTS.includes(sp.sort as ProductSort) ? (sp.sort as ProductSort) : "newest";
  const priceDisabled = search.length > 0;

  return {
    search,
    sort,
    categorySlug: sp.category?.trim() ?? "",
    minPrice: priceDisabled ? undefined : parsePrice(sp.min),
    maxPrice: priceDisabled ? undefined : parsePrice(sp.max),
    isNewArrivals: false,
    priceDisabled,
  };
}

/**
 * Rebuilds a Shop URL from a partial change, dropping empty/default values.
 *
 * Changing any ordinary filter leaves the collection scope (see
 * `parseShopQuery`): picking a category while browsing New Arrivals returns the
 * full catalogue for that category rather than silently keeping a scope the
 * query cannot honour alongside it.
 */
export function buildShopHref(
  pathname: string,
  current: ShopSearchParams,
  next: Partial<ShopSearchParams>,
): string {
  const leavesCollection = Object.keys(next).some((key) => key !== "collection");
  const merged: ShopSearchParams = {
    ...current,
    ...next,
    ...(leavesCollection ? { collection: undefined } : null),
  };
  const params = new URLSearchParams();
  if (merged.collection) params.set("collection", merged.collection);
  if (merged.q) params.set("q", merged.q);
  if (merged.sort && merged.sort !== "newest") params.set("sort", merged.sort);
  if (merged.category) params.set("category", merged.category);
  if (merged.min) params.set("min", merged.min);
  if (merged.max) params.set("max", merged.max);
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}`;
}
