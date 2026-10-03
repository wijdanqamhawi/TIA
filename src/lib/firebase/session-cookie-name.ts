/**
 * Shared session-cookie name constant. Kept in its own tiny module (rather
 * than inside auth.ts, which will depend on firebase-admin) so it can be
 * imported from the Edge middleware without pulling in the Admin SDK.
 */
export const SESSION_COOKIE_NAME = "__session";

/**
 * Staff (ADMIN/OWNER) sessions live in their own cookie, never in
 * `SESSION_COOKIE_NAME`. A browser has one cookie jar, so with a single shared
 * cookie an admin signing in from another tab silently replaced the customer's
 * session (and an admin sign-out ended it) — the customer's own order pages
 * then 404'd as "not your order". Separate cookies let both stay signed in.
 */
export const ADMIN_SESSION_COOKIE_NAME = "__admin_session";
