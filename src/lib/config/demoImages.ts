/**
 * ─────────────────────────────────────────────────────────────────────────
 * TEMPORARY DEMO IMAGERY — PRESENTATION ONLY
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Local placeholder photography so the TIA storefront can be previewed with
 * realistic imagery before the store owner uploads their own. Everything
 * here is a **fallback**: a real Firebase Storage image always wins, and
 * nothing in this file reads, writes, or alters catalog data.
 *
 * Source & licence: Unsplash (https://unsplash.com/license) — free for
 * commercial use, no attribution required. Only free-licence photos are
 * included; no Unsplash+ / premium asset is used. Files are committed
 * locally under `public/images/demo/`, so the storefront never depends on
 * an external image host at runtime and there are no remote URLs to break.
 *
 * ── HOW TO REMOVE THIS ENTIRELY ──────────────────────────────────────────
 * Once the client's real photography is uploaded through `/admin` (product
 * images, category showcases), every resolver below stops being reached on
 * its own, because each one prefers the real image. To delete the demo
 * layer outright: delete `public/images/demo/`, delete this file, and drop
 * the `resolve*` calls at the four call sites listed in each function's
 * doc comment. No data model, schema, or admin behaviour is involved.
 */

/**
 * Paths that are *technically* present on a record but are not real
 * photography. `scripts/seed.ts` points every seeded product image and
 * category showcase at the brand placeholder (`/brand/logo.svg`), so
 * treating a stored URL as "real" purely because it is non-empty would
 * put a logo in the hero and in every Collections circle.
 *
 * This check is deliberately narrow — one known placeholder asset — and
 * it only affects which *image* is displayed. No record is read
 * differently, modified, or migrated, and a genuine uploaded photo (a
 * Firebase Storage URL) is never matched by it.
 */
function isPlaceholderUrl(url: string | null | undefined): boolean {
  return !url || url.includes("/brand/logo.svg") || url.includes("/brand/tia-logo");
}

/**
 * Editorial photography for the long-form homepage sections (The Piece,
 * Shop the Look, Less Ordinary, The Collection). These sections have no
 * dedicated admin image slot, so each prefers a real product photo where
 * one is relevant and otherwise uses the matching demo frame below.
 */
export const DEMO_EDITORIAL = {
  featurePiece: "/images/demo/feature-cuff.jpg",
  lookModel: "/images/demo/look-model.jpg",
  ordinaryProduct: "/images/demo/editorial-ring.jpg",
  ordinaryModel: "/images/demo/editorial-earring-model.jpg",
  storyModel: "/images/demo/story-model.jpg",
  storyDetail: "/images/demo/story-detail.jpg",
  statementStill: "/images/demo/statement-still.jpg",
  statementModel: "/images/demo/statement-model.jpg",
} as const;

/**
 * Any editorial slot: the real uploaded image when there is one, otherwise
 * the given demo frame.
 *
 * Call sites: `src/components/storefront/home/*`.
 */
export function resolveEditorialImage(
  realUrl: string | null | undefined,
  demoUrl: string,
): { url: string; isDemo: boolean } {
  if (!isPlaceholderUrl(realUrl)) return { url: realUrl as string, isDemo: false };
  return { url: demoUrl, isDemo: true };
}

/**
 * First-entry screen (`WelcomeSplash`) campaign photograph — landscape for
 * tablet/desktop, portrait crop for phones. Temporary: to be replaced by
 * the client's own campaign image (swap these two files).
 */
export const DEMO_SPLASH = {
  // Wide dark canvas (2000×1653): the same photograph set smaller and
  // right-aligned, feathered into the splash ground on every side.
  desktopUrl: "/images/demo/splash-model-desktop-lit.jpg",
  // Phone-shaped (1200×2600): the portrait sits in the upper part and fades
  // into the splash ground, keeping the jewellery clear of the brand copy.
  mobileUrl: "/images/demo/splash-model-portrait.jpg",
} as const;

/**
 * The homepage hero artwork — the store owner's **approved** TIA campaign
 * photograph, not demo imagery: a 2172x724 navy frame with the model and
 * the gold jewellery on the end side and an empty navy field on the start
 * side for the hero copy. One landscape file serves both breakpoints; the
 * crop is steered per breakpoint by `object-position` in `Hero.tsx`.
 *
 * This is the only place the hero file path is written. Swapping the hero
 * later means replacing the file at this path (or changing this one line).
 */
export const HOME_HERO = {
  desktopUrl: "/images/home/tia-navy-model-hero.png",
  mobileUrl: "/images/home/tia-navy-model-hero.png",
} as const;

/**
 * Per-category circles, keyed by the category's **slug** (the stable,
 * language-independent identifier already used in catalog URLs). A slug
 * with no entry falls back to `DEMO_COLLECTION_FALLBACK`, so adding a new
 * category in the admin never produces a broken circle.
 */
const DEMO_COLLECTION_BY_SLUG: Record<string, string> = {
  rings: "/images/demo/collection-rings-editorial.jpg",
  earrings: "/images/demo/collection-earrings-editorial.jpg",
  bracelets: "/images/demo/collection-bracelets.jpg",
  necklaces: "/images/demo/collection-necklaces.jpg",
  watches: "/images/demo/collection-watches.jpg",
};

const DEMO_COLLECTION_FALLBACK = "/images/demo/collection-necklaces.jpg";

/** Clean product photography for grid cards. */
const DEMO_PRODUCTS: readonly string[] = [
  "/images/demo/product-01.jpg",
  "/images/demo/product-02.jpg",
  "/images/demo/product-03.jpg",
  "/images/demo/product-04.jpg",
  "/images/demo/product-05.jpg",
  "/images/demo/product-06.jpg",
  "/images/demo/product-07.jpg",
  "/images/demo/product-08.jpg",
];

/**
 * Picks a demo product image deterministically from a product's id, so the
 * same product always shows the same placeholder — across reloads, across
 * sections, and between server and client render (no hydration mismatch,
 * and no `Math.random()`).
 */
function pickByKey(key: string, pool: readonly string[]): string {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return pool[hash % pool.length];
}

/**
 * The demo photo `offset` places after `anchorUrl` in the pool, wrapping
 * around — used by the product-detail gallery so a multi-image product
 * whose images are all seeded placeholders shows a *different* frame per
 * thumbnail instead of the same one repeated.
 *
 * Stepping, rather than hashing a per-image key, is deliberate: the pool is
 * fixed-size, so two hashed keys collide readily (two of three thumbnails
 * landed on the same photo when that was tried). Walking forward from the
 * anchor guarantees distinct frames for up to `DEMO_PRODUCTS.length` images
 * and never returns the anchor itself for `offset` within that range.
 *
 * Presentation only — no real uploaded photo ever reaches this function.
 *
 * Call site: `src/components/storefront/ImageGallery.tsx`.
 */
export function nextDemoProductImage(anchorUrl: string, offset: number): string {
  const anchorIndex = DEMO_PRODUCTS.indexOf(anchorUrl);
  const base = anchorIndex >= 0 ? anchorIndex : 0;
  return DEMO_PRODUCTS[(base + offset) % DEMO_PRODUCTS.length];
}

/**
 * Hero artwork. Prefers the store's real Category Showcase imagery; falls
 * back to the approved TIA hero photograph (`HOME_HERO`) when none has
 * been uploaded.
 *
 * Call site: `src/app/[locale]/(storefront)/page.tsx`.
 */
export function resolveHeroImage(
  real: { desktopUrl: string; mobileUrl: string } | null,
): { desktopUrl: string; mobileUrl: string; isDemo: boolean } {
  if (real && !isPlaceholderUrl(real.desktopUrl)) return { ...real, isDemo: false };
  return { ...HOME_HERO, isDemo: false };
}

/**
 * A Collections circle. Prefers the real product photo the category
 * already surfaces; falls back to a slug-matched demo image.
 *
 * Call site: `src/components/storefront/FeaturedCategories.tsx`.
 */
export function resolveCollectionImage(
  realUrl: string | null | undefined,
  categorySlug: string,
): { url: string; isDemo: boolean } {
  if (!isPlaceholderUrl(realUrl)) return { url: realUrl as string, isDemo: false };
  return {
    url: DEMO_COLLECTION_BY_SLUG[categorySlug] ?? DEMO_COLLECTION_FALLBACK,
    isDemo: true,
  };
}

/**
 * A product card image. Prefers the product's real uploaded photo; falls
 * back to a deterministic demo image chosen from the product's id.
 *
 * Call sites: `ProductCard.tsx`, `QuickView.tsx`.
 */
export function resolveProductImage(
  realUrl: string | null | undefined,
  productId: string,
): { url: string; isDemo: boolean } {
  if (!isPlaceholderUrl(realUrl)) return { url: realUrl as string, isDemo: false };
  return { url: pickByKey(productId, DEMO_PRODUCTS), isDemo: true };
}
