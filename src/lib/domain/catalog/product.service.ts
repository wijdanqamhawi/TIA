import "server-only";
import type { Query, Transaction } from "firebase-admin/firestore";
import { Timestamp } from "firebase-admin/firestore";
import { productsCollection } from "@/lib/firebase/firestore";
import { slugify } from "@/lib/utils/slugify";
import { buildSearchTerms } from "@/lib/utils/searchTokens";
import type { Product } from "@/types/product";
import { isSoldOut } from "./soldOut";
import { getOfferStatus, resolveOfferPricing, type OfferStatus } from "./offer";

/**
 * Derives a product's slug from `name.en` (data-model.md — slugs are
 * always derived from the English name, language-independent, never from
 * Arabic text).
 */
export function deriveProductSlug(nameEn: string): string {
  return slugify(nameEn);
}

/**
 * Transactional slug-uniqueness check (read-check-then-write, since
 * Firestore has no native unique-constraint feature — data-model.md
 * "Uniqueness without unique indexes"). Aborts the caller's transaction by
 * throwing if a *different* product already has this slug. Accepts an
 * optional `Transaction` so callers that are already inside a Firestore
 * transaction (e.g. the admin create/update Server Action, Phase 10) get a
 * consistent read; a caller with no transaction yet (e.g. `scripts/seed.ts`)
 * may omit it.
 */
export async function assertUniqueProductSlug(
  slug: string,
  options?: { excludeProductId?: string; transaction?: Transaction },
): Promise<void> {
  const query = productsCollection().where("slug", "==", slug).limit(1);
  const snapshot = options?.transaction ? await options.transaction.get(query) : await query.get();

  const conflict = snapshot.docs.find((doc) => doc.id !== options?.excludeProductId);
  if (conflict) {
    throw new Error(`A product with slug "${slug}" already exists.`);
  }
}

// --- Cart-line availability validation (spec Edge Cases; consumed by
// Phase 6's addCartItemAction/updateCartItemQuantityAction, T099/T100) ---

export type CartLineValidation =
  | { ok: true }
  | { ok: false; reason: "NOT_AVAILABLE" | "SOLD_OUT" | "INSUFFICIENT_STOCK" | "INVALID_QUANTITY" };

/**
 * Server-side stock/Sold-Out/hidden validation for a requested cart-line
 * quantity against a freshly-read `Product` — rejects an invalid quantity,
 * a Sold Out product, or a hidden (`availability: false`) product. This is
 * the reusable check Phase 6's cart Server Actions call on every add/
 * update, and Phase 8's checkout re-validation (`checkout.service.ts`)
 * calls again authoritatively at order-creation time — never trusted from
 * a client-submitted quantity or stale cart line (spec FR-026).
 *
 * Deliberately independent of, and never overridden by, a product's
 * Special Offers state: a Sold Out product on an `ACTIVE` offer is still
 * rejected here exactly as any other Sold Out product would be (spec
 * FR-122) — this function never even reads `isOnSale`/`salePrice`.
 */
export function validateCartLineAvailability(
  product: Pick<Product, "availability" | "stock">,
  requestedQuantity: number,
): CartLineValidation {
  if (!Number.isInteger(requestedQuantity) || requestedQuantity <= 0) {
    return { ok: false, reason: "INVALID_QUANTITY" };
  }
  if (!product.availability) {
    return { ok: false, reason: "NOT_AVAILABLE" };
  }
  if (isSoldOut(product)) {
    return { ok: false, reason: "SOLD_OUT" };
  }
  if (requestedQuantity > product.stock) {
    return { ok: false, reason: "INSUFFICIENT_STOCK" };
  }
  return { ok: true };
}

// --- Catalog listing query (Shop/category pages, spec FR-007a/FR-007b/FR-009) ---

export type ProductSort = "newest" | "price" | "popularity";

const SORT_FIELD: Record<ProductSort, "createdAt" | "price" | "salesCount"> = {
  newest: "createdAt",
  price: "price",
  popularity: "salesCount",
};

const SORT_DIRECTION: Record<ProductSort, FirebaseFirestore.OrderByDirection> = {
  newest: "desc",
  price: "asc",
  popularity: "desc",
};

export type ListProductsParams = {
  categoryId?: string;
  /** Free-text search — matched against `searchTerms` in either language (research.md §17a). */
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  /**
   * Scopes the listing to the New Arrivals collection (`isNewArrival == true`,
   * data-model.md "Collection" — a derived query over a Product flag, not a
   * curated membership list).
   *
   * Only the standalone form is indexed: `isNewArrival ASC, availability ASC,
   * createdAt DESC` (firestore.indexes.json). Combining it with a category, a
   * price range, a search or a non-`createdAt` sort would need a composite
   * index per combination, none of which exist — so `parseShopQuery` treats the
   * collection as an exclusive scope and never sends those combinations here.
   *
   * Sold Out products are excluded from the collection — see
   * `excludeSoldOut` below.
   */
  isNewArrival?: boolean;
  sort?: ProductSort;
  pageSize?: number;
  /** The last product id from the previous page, for cursor-based pagination. */
  cursorId?: string | null;
};

export type ListProductsResult = {
  products: Product[];
  nextCursorId: string | null;
};

const DEFAULT_PAGE_SIZE = 12;
const MAX_SEARCH_TOKENS = 10; // Firestore's array-contains-any limit

/**
 * Drops Sold Out products from a **collection** result set.
 *
 * ── WHY IN MEMORY, AND WHY ONLY FOR COLLECTIONS ──────────────────────────
 * Sold Out is derived live from `stock`, never stored (`isSoldOut`, spec
 * FR-015a), so Firestore cannot be asked for it without adding a `stock`
 * inequality to every collection query — a second inventory rule, a new
 * composite index per collection, and a value that could drift from the
 * derivation. This reuses the one existing rule instead.
 *
 * It applies to the New Arrivals collection only, not to the catalogue: a
 * Sold Out product stays browsable on `/shop`, on its category page and on its
 * own detail page exactly as FR-015a requires. New Arrivals is a curated
 * merchandising selection — showing an unbuyable piece as the store's newest
 * is the thing this excludes.
 */
function excludeSoldOut(products: Product[]): Product[] {
  return products.filter((product) => !isSoldOut(product));
}

/**
 * The product listing query (Shop page, category pages, spec FR-007a/
 * FR-007b): search, category filter, price filter, newest/price/
 * popularity sort, cursor-based pagination. Filters only on
 * `availability` — never `stock` — so a Sold Out product stays browsable
 * (spec FR-015a). The single exception is the New Arrivals collection scope,
 * which is merchandising rather than the catalogue — see `excludeSoldOut`.
 *
 * A keyword search and a price-range filter are not combined in the same
 * request: `array-contains-any` (search) cannot share a composite index
 * with an inequality range on a different field, and this catalog's scale
 * doesn't warrant maintaining that index combination (research.md §17a) —
 * when `search` is provided, `minPrice`/`maxPrice` are ignored and results
 * use Firestore's natural document order rather than the requested sort,
 * since ordering search matches by an unrelated field would need its own
 * per-sort composite index too.
 */
export async function listProducts(params: ListProductsParams = {}): Promise<ListProductsResult> {
  const {
    categoryId,
    search,
    minPrice,
    maxPrice,
    isNewArrival,
    sort = "newest",
    pageSize = DEFAULT_PAGE_SIZE,
    cursorId,
  } = params;

  let query: Query<Product> = productsCollection();

  const searchTokens = search ? buildSearchTerms(search).slice(0, MAX_SEARCH_TOKENS) : [];
  const isSearching = searchTokens.length > 0;

  if (isSearching) {
    query = query.where("searchTerms", "array-contains-any", searchTokens);
  }

  if (categoryId) {
    query = query.where("categoryId", "==", categoryId);
  }

  if (isNewArrival) {
    query = query.where("isNewArrival", "==", true);
  }

  query = query.where("availability", "==", true);

  const hasPriceRange = !isSearching && (minPrice !== undefined || maxPrice !== undefined);
  if (hasPriceRange) {
    if (minPrice !== undefined) query = query.where("price", ">=", minPrice);
    if (maxPrice !== undefined) query = query.where("price", "<=", maxPrice);
  }

  if (!isSearching) {
    const effectiveSort: ProductSort = hasPriceRange ? "price" : sort;
    query = query.orderBy(SORT_FIELD[effectiveSort], SORT_DIRECTION[effectiveSort]);
  }

  if (cursorId) {
    const cursorDoc = await productsCollection().doc(cursorId).get();
    if (cursorDoc.exists) {
      query = query.startAfter(cursorDoc);
    }
  }

  const snapshot = await query.limit(pageSize).get();
  const fetched = snapshot.docs.map((doc) => doc.data());

  // The cursor is taken from the *raw* page, before any in-memory filtering,
  // so paging still walks whole Firestore pages and no product is skipped or
  // repeated. A collection page can therefore render fewer than `pageSize`
  // items — correct, and preferable to a second round-trip per page at this
  // catalogue's scale (research.md §17).
  const nextCursorId = fetched.length === pageSize ? fetched[fetched.length - 1].id : null;
  const products = isNewArrival ? excludeSoldOut(fetched) : fetched;

  return { products, nextCursorId };
}

// --- Related products (product detail page, spec: same-category suggestions) ---

const RELATED_PRODUCTS_LIMIT = 4;

/** Same-category suggestions for the product detail page, excluding the viewed product itself. */
export async function getRelatedProducts(
  categoryId: string,
  excludeProductId: string,
  limit = RELATED_PRODUCTS_LIMIT,
): Promise<Product[]> {
  const snapshot = await productsCollection()
    .where("categoryId", "==", categoryId)
    .where("availability", "==", true)
    .orderBy("createdAt", "desc")
    .limit(limit + 1)
    .get();

  return snapshot.docs
    .map((doc) => doc.data())
    .filter((product) => product.id !== excludeProductId)
    .slice(0, limit);
}

/** Reads a single product by its language-independent slug, or null if not found/available. */
export async function getProductBySlug(slug: string): Promise<Product | null> {
  const snapshot = await productsCollection().where("slug", "==", slug).limit(1).get();
  return snapshot.empty ? null : snapshot.docs[0].data();
}

/** Reads a single product by its document ID, or null if it doesn't exist. */
export async function getProductById(productId: string): Promise<Product | null> {
  const snapshot = await productsCollection().doc(productId).get();
  return snapshot.exists ? snapshot.data()! : null;
}

// --- Homepage collections (spec FR-001, "New Arrivals" / "Best Sellers") ---

const COLLECTION_SECTION_LIMIT = 8;

/** Over-fetches so filtering Sold Out products out still leaves a full row. */
const COLLECTION_CANDIDATE_MULTIPLIER = 3;

/**
 * Most-recently-created available, in-stock products (homepage "New Arrivals"
 * section, and the `/shop?collection=new-arrivals` view's own query).
 *
 * Over-fetches candidates so dropping the Sold Out ones (`excludeSoldOut`)
 * still leaves up to `limit` results — the same shape `getSpecialOffers` uses
 * for its own post-query filtering.
 */
export async function getNewArrivals(limit = COLLECTION_SECTION_LIMIT): Promise<Product[]> {
  const snapshot = await productsCollection()
    .where("isNewArrival", "==", true)
    .where("availability", "==", true)
    .orderBy("createdAt", "desc")
    .limit(limit * COLLECTION_CANDIDATE_MULTIPLIER)
    .get();

  return excludeSoldOut(snapshot.docs.map((doc) => doc.data())).slice(0, limit);
}

/** Top-selling available products by cumulative quantity sold (homepage "Best Sellers" section). */
export async function getBestSellers(limit = COLLECTION_SECTION_LIMIT): Promise<Product[]> {
  const snapshot = await productsCollection()
    .where("isBestSeller", "==", true)
    .where("availability", "==", true)
    .orderBy("salesCount", "desc")
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => doc.data());
}

// --- Special Offers (spec User Story 10, FR-117; data-model.md "Offer status derivation") ---

/** Over-fetches candidates so filtering out non-ACTIVE offers still leaves up to `limit` results. */
const SPECIAL_OFFERS_CANDIDATE_MULTIPLIER = 3;

/**
 * Live, currently-`ACTIVE` special offers for the homepage "Special Offers
 * / عروض خاصة" section (T320/T321). Firestore cannot combine the
 * `isOnSale == true` equality filter with independent range filters on
 * both `saleStartAt` and `saleEndAt` in one query, so this fetches a
 * bounded candidate set via `isOnSale == true AND availability == true`
 * (backed by the composite index in `firestore.indexes.json`) and then
 * filters to `ACTIVE` in application code — the same workaround pattern
 * already used for bilingual `searchTerms` search (research.md §17a/§48).
 */
export async function getSpecialOffers(limit = COLLECTION_SECTION_LIMIT): Promise<Product[]> {
  const snapshot = await productsCollection()
    .where("isOnSale", "==", true)
    .where("availability", "==", true)
    .orderBy("createdAt", "desc")
    .limit(limit * SPECIAL_OFFERS_CANDIDATE_MULTIPLIER)
    .get();

  const now = Timestamp.now();
  return snapshot.docs
    .map((doc) => doc.data())
    .filter((product) => getOfferStatus(product, now) === "ACTIVE")
    .slice(0, limit);
}

// --- Server → Client Component serialization boundary ---

export type ProductCardData = Pick<
  Product,
  | "id"
  | "slug"
  | "name"
  | "price"
  | "images"
  | "stock"
  | "availability"
  | "isNewArrival"
  | "isBestSeller"
  | "options"
> & {
  /** Derived, never stored (data-model.md "Offer status derivation") — only `ACTIVE` counts as on sale. */
  offerStatus: OfferStatus;
  /** `salePrice` while `offerStatus === "ACTIVE"`, otherwise identical to `price` (spec FR-116/FR-119). */
  effectivePrice: number;
  /** Whether the current signed-in customer already has this product (no option) on her wishlist — always `false` for a guest. Lets `<ProductCard>` render a filled heart and toggle add/remove instead of only ever adding (spec FR-032/FR-033a). */
  isWishlisted: boolean;
};

/**
 * Strips every field a `<ProductCard>` (Client Component) doesn't need —
 * critically, `createdAt`/`updatedAt` (Firestore `Timestamp` instances,
 * which the React Server Components serialization boundary cannot pass to
 * a Client Component or return from a Server Action as-is) and the raw
 * `isOnSale`/`salePrice`/`saleStartAt`/`saleEndAt` fields (also
 * Timestamps). Apply this at every point a `Product` crosses from a Server
 * Component/Server Action into client code.
 *
 * The offer status/effective price are derived here, server-side, at the
 * exact moment of the read — never passed through as raw fields for the
 * client to (re)derive itself — so every surface that renders a
 * `ProductCardData` (Home, Shop, category pages, Quick View, related
 * products) shows identical pricing for the same product at the same
 * moment (spec SC-028).
 */
export function toProductCardData(product: Product, wishlistedProductIds?: Set<string>): ProductCardData {
  const { offerStatus, effectivePrice } = resolveOfferPricing(product);
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    price: product.price,
    images: product.images,
    stock: product.stock,
    availability: product.availability,
    isNewArrival: product.isNewArrival,
    isBestSeller: product.isBestSeller,
    options: product.options,
    offerStatus,
    effectivePrice,
    isWishlisted: wishlistedProductIds?.has(product.id) ?? false,
  };
}

// --- Batch reads (cart/wishlist enrichment) ---

/**
 * Reads several products by ID in one batch (Firestore `getAll`), for
 * joining cart/wishlist lines against live product data without an N+1
 * read per line. Missing/deleted products are simply absent from the
 * returned map — callers must handle that case (data-model.md, "Cart/
 * wishlist referential cleanup").
 */
export async function getProductsByIds(productIds: string[]): Promise<Map<string, Product>> {
  const uniqueIds = Array.from(new Set(productIds));
  if (uniqueIds.length === 0) return new Map();

  const refs = uniqueIds.map((id) => productsCollection().doc(id));
  const snapshots = await productsCollection().firestore.getAll(...refs);

  const map = new Map<string, Product>();
  for (const snapshot of snapshots) {
    if (snapshot.exists) {
      map.set(snapshot.id, snapshot.data() as Product);
    }
  }
  return map;
}

/**
 * Validates that a cart line's `selectedOption` references a real
 * `optionKey`/`valueKey` pair on the product (spec: "Selected option/color
 * exists") — never trusted from the client beyond structural shape
 * (Constitution Principle 13).
 */
export function isSelectedOptionValid(
  product: Pick<Product, "options">,
  selectedOption: { optionKey: string; valueKey: string } | null | undefined,
): boolean {
  if (!selectedOption) {
    // Valid only if the product itself defines no options to choose from.
    return product.options.length === 0;
  }

  const option = product.options.find((o) => o.key === selectedOption.optionKey);
  if (!option) return false;
  return option.values.some((v) => v.key === selectedOption.valueKey);
}

// --- Admin listing (minimal, offer-management-scoped — full Phase 10
// product management with search/filter/pagination is not yet built) ---

const ADMIN_PRODUCT_LIST_LIMIT = 200;

/**
 * Every product (regardless of `availability`), newest first, for the
 * minimal `/admin/products` offer-management listing (T328–T330). Unlike
 * `listProducts`, this deliberately does not filter on `availability` — an
 * admin managing offers needs to see every product, including a currently
 * hidden one. Not paginated/searchable; Phase 10's full admin product
 * management will supersede this with the real, filterable listing.
 */
export async function getAllProductsForAdmin(limit = ADMIN_PRODUCT_LIST_LIMIT): Promise<Product[]> {
  const snapshot = await productsCollection().orderBy("createdAt", "desc").limit(limit).get();
  return snapshot.docs.map((doc) => doc.data());
}

// --- Sitemap (T219) ---

const SITEMAP_PRODUCT_LIMIT = 5000;

/**
 * Every publicly-visible (`availability: true`) product's `slug` and
 * `updatedAt`, for `app/sitemap.ts` (T219) — never a page a shopper
 * couldn't actually reach, and never the full `Product` document (the
 * sitemap needs only these two fields).
 */
export async function getSitemapProducts(): Promise<Pick<Product, "slug" | "updatedAt">[]> {
  const snapshot = await productsCollection()
    .where("availability", "==", true)
    .limit(SITEMAP_PRODUCT_LIMIT)
    .get();
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return { slug: data.slug, updatedAt: data.updatedAt };
  });
}
