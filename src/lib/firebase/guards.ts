import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionCookie, type SessionClaims } from "./auth";

export class UnauthenticatedError extends Error {
  constructor(message = "Authentication required.") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Reads and verifies the session cookie, if any. Never throws. */
export async function getSessionClaims(): Promise<SessionClaims | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return null;
  return verifySessionCookie(sessionCookie);
}

/**
 * The authoritative "is this caller signed in" check (layer 2 of 3,
 * research.md §9). Every Server Action/Route Handler/Server Component that
 * requires a signed-in customer or admin calls this — never a
 * client-supplied uid or role.
 */
export async function requireUser(): Promise<SessionClaims> {
  const claims = await getSessionClaims();
  if (!claims) {
    throw new UnauthenticatedError();
  }
  return claims;
}

/**
 * The authoritative "is this caller an admin" check. Rejects both an
 * unauthenticated caller and an authenticated non-admin caller — this is
 * the real enforcement point that a hidden nav link or client-side check
 * can never substitute for (Constitution Principle 6).
 */
export async function requireAdmin(): Promise<SessionClaims> {
  const claims = await requireUser();
  if (claims.role !== "ADMIN") {
    throw new ForbiddenError();
  }
  return claims;
}
