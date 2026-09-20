import { Serwist, NetworkOnly } from "serwist";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

/**
 * The Serwist service worker source (T192–T194, research.md §24,
 * security-critical). `self.__SW_MANIFEST` is the build-time precache
 * manifest `@serwist/next`'s webpack plugin injects here — the static app
 * shell (JS/CSS, already content-hashed by Next.js) and self-hosted font
 * files.
 *
 * `public/**` assets (brand/icon assets) are precached explicitly below,
 * with forward-slash URLs, rather than via `@serwist/next`'s automatic
 * `globPublicPatterns` public-folder globbing — that glob builds its URLs
 * using the host OS's path separator, which on Windows produces broken
 * `/icons\icon-192.png`-style URLs that always 404 and leave the service
 * worker stuck "installing" forever (Workbox's install step requires every
 * precache entry to fetch successfully). `globPublicPatterns` is disabled
 * in `next.config.ts` accordingly.
 *
 * `/offline` (T196) is added explicitly too, since it's a route, not a
 * static file under `public/`.
 */
/**
 * A revision that actually changes when the app does.
 *
 * This used to be `process.env.npm_package_version ?? "1"`, which is not
 * defined in the service-worker bundle and so evaluated to the same
 * constant in every build ever made. A precache entry whose revision never
 * changes is never re-fetched — which is why `/offline`, precached under
 * the previous brand, kept being served as the old ELORA screen long after
 * the app became TIA, and why the stale caches outlived the rebrand.
 *
 * `self.__SW_MANIFEST` is the build-time manifest of the app shell, whose
 * URLs and revisions are content-hashed by Next.js, so it differs whenever
 * the built app differs. Folding it into one short token gives every
 * explicitly-precached entry a revision that moves with the build.
 */
function buildRevision(entries: (PrecacheEntry | string)[] | undefined): string {
  const source = JSON.stringify(entries ?? []);
  let hash = 0;
  for (let index = 0; index < source.length; index++) {
    hash = (Math.imul(hash, 31) + source.charCodeAt(index)) | 0;
  }
  return (hash >>> 0).toString(36);
}

// Referenced exactly once: Serwist's webpack plugin injects the manifest by
// replacing this token, and refuses to build if it appears more than once.
const SW_MANIFEST: (PrecacheEntry | string)[] = self.__SW_MANIFEST ?? [];
const BUILD_REVISION = buildRevision(SW_MANIFEST);
/**
 * Namespaces the *runtime* caches this worker owns. `tia-`, never the old
 * brand.
 *
 * Deliberately not treated as the prefix of every cache: Serwist resolves
 * the precache's name (`serwist-precache-v2-<scope>`) in the first line of
 * its constructor, before `cacheId` is applied, so the precache keeps the
 * default prefix no matter what this says.
 */
const CACHE_ID = `tia-${BUILD_REVISION}`;

/** The `cacheId` every pre-rebrand build shipped, whose caches are now dead. */
const LEGACY_CACHE_PREFIX = "elora-";

const PUBLIC_ASSET_PRECACHE_ENTRIES = [
  "/brand/logo.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-512-maskable.png",
  "/icons/apple-touch-icon.png",
  "/icons/favicon-32.png",
  "/icons/favicon-16.png",
].map((url) => ({ url, revision: BUILD_REVISION }));

const serwist = new Serwist({
  precacheEntries: [...SW_MANIFEST, ...PUBLIC_ASSET_PRECACHE_ENTRIES, { url: "/offline", revision: BUILD_REVISION }],
  // Workbox/Serwist's precache controller already deletes any cache left
  // over from a previous manifest on activation ("cleanupOutdatedCaches")
  // — this is what satisfies T194's "purge prior-version caches on
  // activate" for everything precached above; `cacheId` additionally
  // namespaces every cache this worker owns by the current app version, so
  // two different deployed versions active in different tabs can never
  // read each other's cache.
  cacheId: CACHE_ID,
  skipWaiting: true,
  clientsClaim: true,
  runtimeCaching: [
    // Explicit, security-critical exclusions (research.md §24) — these
    // never go through the Cache API, always the live network, regardless
    // of locale prefix. Server Actions are POST requests (the Cache API
    // can't cache non-GET requests at all), but the exclusion is still
    // made explicit here for clarity per the same rationale. There is
    // currently no genuinely static marketing page in this app (every
    // storefront page renders at least one live Firestore read — New
    // Arrivals/Best Sellers/Special Offers/category showcases on the
    // homepage, live listings on Shop/category, etc.), so the
    // stale-while-revalidate allowlist this policy reserves for that case
    // is intentionally empty rather than caching something that
    // shouldn't be — add a scoped `StaleWhileRevalidate` route here only
    // for a page proven to render no live commerce/account data.
    {
      matcher: ({ url, sameOrigin }) =>
        sameOrigin &&
        (url.pathname.startsWith("/api/") ||
          url.pathname.startsWith("/admin") ||
          /^\/(en|ar)(\/|$)/.test(url.pathname)),
      handler: new NetworkOnly(),
    },
  ],
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

/**
 * Deletes the caches left behind by pre-rebrand builds, on activate.
 *
 * Only those. An earlier version of this handler deleted every cache whose
 * name did not start with `CACHE_ID`, on the assumption that `cacheId`
 * prefixes all of them — it does not, as noted above, so that handler
 * deleted the precache itself on every activation. The result was an
 * empty Cache Storage, a `/offline` fallback that could never be served,
 * and `pwa.spec.ts`'s offline test failing on all five projects in CI run
 * 35529297026.
 *
 * Serwist's `cleanupOutdatedCaches` already retires superseded precaches,
 * and the only runtime caches this worker creates are `CACHE_ID`-prefixed,
 * so the single thing left unmanaged is the old brand's namespace.
 */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => name.startsWith(LEGACY_CACHE_PREFIX)).map((name) => caches.delete(name)),
      );
    })(),
  );
});

serwist.addEventListeners();
