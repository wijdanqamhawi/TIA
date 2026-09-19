import "server-only";
import { getAdminAuth } from "./admin";
import { SESSION_COOKIE_NAME } from "./session-cookie-name";
import { toUserRole, type UserRole } from "@/lib/auth/roles";

export { SESSION_COOKIE_NAME };

/** Firebase's own maximum session-cookie lifetime is 14 days. */
export const SESSION_COOKIE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export type CreatedSession = {
  sessionCookie: string;
  uid: string;
  email: string | null;
  name: string | null;
};

/**
 * Verifies a freshly-obtained Firebase ID token (from the client SDK) and
 * mints an httpOnly Firebase session cookie (research.md §8). The caller
 * (createSessionAction) is responsible for actually setting the cookie on
 * the response via `next/headers`.
 */
export async function createSessionCookie(idToken: string): Promise<CreatedSession> {
  const adminAuth = getAdminAuth();

  // Verifying the ID token first (rather than trusting createSessionCookie
  // alone) ensures we reject a stale/replayed/tampered token with a clear
  // error before minting any session credential.
  const decoded = await adminAuth.verifyIdToken(idToken);
  const sessionCookie = await adminAuth.createSessionCookie(idToken, {
    expiresIn: SESSION_COOKIE_MAX_AGE_MS,
  });

  return {
    sessionCookie,
    uid: decoded.uid,
    email: decoded.email ?? null,
    name: typeof decoded.name === "string" ? decoded.name : null,
  };
}

/** Invalidates every existing session/refresh token for this user server-side. */
export async function revokeAllSessions(uid: string): Promise<void> {
  await getAdminAuth().revokeRefreshTokens(uid);
}

export type SessionClaims = {
  uid: string;
  email: string | null;
  role: UserRole;
};

/**
 * Verifies a session cookie via the Admin SDK — the sole authoritative
 * check every Server Action/Route Handler/Server Component uses (research
 * .md §9). Never trusts a client-supplied uid or role. `checkRevoked: true`
 * ensures a revoked session (e.g. `logoutAction`'s "sign out everywhere")
 * is rejected even if the cookie itself hasn't expired yet.
 */
export async function verifySessionCookie(sessionCookie: string): Promise<SessionClaims | null> {
  try {
    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    const role = toUserRole(decoded.role);
    return { uid: decoded.uid, email: decoded.email ?? null, role };
  } catch {
    return null;
  }
}
