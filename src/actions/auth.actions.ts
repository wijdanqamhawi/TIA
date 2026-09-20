"use server";

import { cookies } from "next/headers";
import { FieldValue } from "firebase-admin/firestore";
import {
  createSessionCookie,
  revokeAllSessions,
  SESSION_COOKIE_MAX_AGE_MS,
  SESSION_COOKIE_NAME,
} from "@/lib/firebase/auth";
import { getSessionClaims } from "@/lib/firebase/guards";
import { usersCollection } from "@/lib/firebase/firestore";
import { createSessionInputSchema } from "@/lib/validation/auth.schema";
import { actionError, actionOk, actionValidationError, type ActionResult } from "@/lib/validation/common";
import { logger } from "@/lib/utils/logger";
import { rateLimit } from "@/lib/utils/rate-limit";
import { getClientIp } from "@/lib/utils/request-ip";
import { readGuestCartId, clearGuestCartCookie } from "@/lib/domain/cart/guest-cart";
import { mergeGuestCartIntoUserCart } from "@/lib/domain/cart/cart-merge.service";
import { parseWishlistIntent } from "@/lib/domain/wishlist/wishlist-intent";
import { addItemToWishlist } from "@/lib/domain/wishlist/wishlist.service";
import { getProductById, isSelectedOptionValid } from "@/lib/domain/catalog/product.service";
import { toUserRole, type UserRole } from "@/lib/auth/roles";
import { cookieSecure } from "@/lib/config/cookies";

export type SessionResult = { uid: string; role: UserRole };

const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  // Evaluated at module load like the rest of these options; `cookieSecure`
  // reads the environment itself (see lib/config/cookies.ts).
  secure: cookieSecure(),
  sameSite: "lax" as const,
  path: "/",
  maxAge: Math.floor(SESSION_COOKIE_MAX_AGE_MS / 1000),
};

/**
 * Verifies a client-obtained Firebase ID token, mints a session cookie,
 * and creates/syncs the `users/{uid}` Firestore document (`role:
 * "CUSTOMER"` on first sign-up — there is no public admin-registration
 * path, research.md §21). Used by both /login and /register after the
 * client SDK step completes (contracts/server-actions.md).
 *
 * Guest-cart merge (T103, research.md §6) and wishlist-intent completion
 * (T114, research.md §7) both run here on every successful sign-in/
 * sign-up — neither ever fails the sign-in itself if it errors.
 *
 * Rate-limited per client IP (T230, research.md §13) as a defense-in-depth
 * backstop against hammering session creation — Firebase Authentication's
 * own built-in abuse protection on the underlying sign-in attempt is the
 * primary control; this only guards this action's own request volume.
 */
export async function createSessionAction(input: unknown): Promise<ActionResult<SessionResult>> {
  const ip = await getClientIp();
  if (!rateLimit(`login:${ip}`, 20, 60 * 1000).allowed) {
    return actionError("RATE_LIMITED", "Too many sign-in attempts. Please wait a moment and try again.");
  }

  const parsed = createSessionInputSchema.safeParse(input);
  if (!parsed.success) {
    return actionValidationError(parsed.error);
  }

  let session;
  try {
    session = await createSessionCookie(parsed.data.idToken);
  } catch (err) {
    logger.warn("createSessionAction: invalid ID token", { error: String(err) });
    return actionError("INVALID_TOKEN", "Your sign-in could not be verified. Please try again.");
  }

  const { uid, email, name } = session;
  const userRef = usersCollection().doc(uid);
  const existing = await userRef.get();

  let role: UserRole = "CUSTOMER";

  if (!existing.exists) {
    await userRef.set({
      id: uid,
      uid,
      name: name ?? "Customer",
      email: email ?? "",
      phone: null,
      role: "CUSTOMER",
      profile: { address: null },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } else {
    const data = existing.data();
    role = toUserRole(data?.role);
    // Keep the mirrored email in sync with the Firebase Auth account; it
    // is never independently editable (data-model.md).
    if (data?.email !== email) {
      await userRef.update({ email: email ?? "", updatedAt: FieldValue.serverTimestamp() });
    }
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, session.sessionCookie, SESSION_COOKIE_OPTIONS);

  const guestCartId = await readGuestCartId();
  if (guestCartId) {
    try {
      await mergeGuestCartIntoUserCart(uid, guestCartId);
    } catch (err) {
      // Never fail sign-in over a cart merge issue — the guest cart cookie
      // is left in place so a retry (e.g. next sign-in) can still merge it.
      logger.error("createSessionAction: guest cart merge failed", { uid, error: String(err) });
      return actionOk({ uid, role });
    }
    await clearGuestCartCookie();
  }

  const wishlistIntent = parseWishlistIntent(parsed.data.intent);
  if (wishlistIntent) {
    try {
      const product = await getProductById(wishlistIntent.productId);
      if (product && isSelectedOptionValid(product, wishlistIntent.selectedOption)) {
        await addItemToWishlist(uid, wishlistIntent.productId, wishlistIntent.selectedOption);
      }
      // A stale/no-longer-valid intent (deleted product, removed option) is
      // silently ignored, not surfaced as a sign-in error — the guest
      // action it referred to is simply no longer possible.
    } catch (err) {
      logger.error("createSessionAction: wishlist intent completion failed", { uid, error: String(err) });
    }
  }

  return actionOk({ uid, role });
}

/**
 * Clears the session cookie; optionally revokes every refresh token for
 * the signed-in user (full "sign out everywhere") when requested.
 */
export async function logoutAction(options?: { everywhere?: boolean }): Promise<ActionResult<null>> {
  const claims = await getSessionClaims();

  if (options?.everywhere && claims) {
    await revokeAllSessions(claims.uid);
  }

  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);

  return actionOk(null);
}
