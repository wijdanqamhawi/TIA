import "server-only";
import { revalidatePath } from "next/cache";

/**
 * On-demand cache invalidation for admin catalog/showcase mutations
 * (T224). Every storefront route is already `export const dynamic =
 * "force-dynamic"` (Constitution Principle 7/9/10 — Firestore is always
 * read live, never cached), so in this codebase these calls are
 * defense-in-depth rather than the primary freshness guarantee: they
 * ensure the storefront can never show stale catalog/showcase data even
 * if a future change ever opts a route back into caching.
 *
 * `revalidateTag` deliberately isn't used here: it only invalidates
 * tagged `fetch()`/`unstable_cache()` entries, and every storefront read
 * in this app goes through the Firebase Admin SDK directly, not `fetch`
 * — there is no tag to attach. `revalidatePath` invalidates Next's Route
 * Cache for the given path template regardless of the underlying data
 * source, which is what actually applies here.
 */
export function invalidateStorefrontCatalog(): void {
  try {
    // `type: "layout"` cascades to every nested route under the `[locale]`
    // segment — home, shop, every category page, every product page —
    // without having to enumerate each one (and risk missing a new route
    // added later).
    revalidatePath("/[locale]", "layout");
  } catch {
    // `revalidatePath` requires an active Next.js request-scoped store;
    // it throws when an admin action is invoked outside that lifecycle
    // (e.g. a unit test calling the action function directly). Since this
    // call is already just defense-in-depth on force-dynamic routes, a
    // missing request context is never a correctness issue worth failing
    // the action over.
  }
}
