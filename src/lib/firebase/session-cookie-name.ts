/**
 * Shared session-cookie name constant. Kept in its own tiny module (rather
 * than inside auth.ts, which will depend on firebase-admin) so it can be
 * imported from the Edge middleware without pulling in the Admin SDK.
 */
export const SESSION_COOKIE_NAME = "__session";
