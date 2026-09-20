import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { logger } from "@/lib/utils/logger";
import { cookieSecure } from "@/lib/config/cookies";

/**
 * Guest order-confirmation access control. Order numbers are sequential
 * (`ELR-YYYYMMDD-NNNN`) and therefore guessable — without this, any guest
 * could enumerate order numbers and view another customer's name/phone/
 * address/order contents on `/order-confirmation/[orderNumber]`
 * (Constitution Principle 6, this task's explicit "must not access
 * another customer's protected order data" requirement).
 *
 * A signed, httpOnly cookie recording exactly the order number(s) this
 * browser has just placed as a guest is set right after a successful
 * guest checkout; the confirmation page grants access only if this cookie
 * verifies for the requested order number, or the viewer is signed in as
 * the order's own `userId`. Mirrors `guest-cart.ts`'s HMAC-signing
 * pattern.
 */
export const GUEST_ORDER_ACCESS_COOKIE_NAME = "__guest_order_access";
const GUEST_ORDER_ACCESS_MAX_AGE_SECONDS = 60 * 60; // 1 hour — long enough to view/refresh the confirmation page

const DEV_ONLY_FALLBACK_SECRET = "dev-only-insecure-guest-order-access-secret";

function getSecret(): string {
  const secret = process.env.CART_COOKIE_SECRET;
  if (secret) return secret;

  if (process.env.NODE_ENV === "production") {
    throw new Error("Missing CART_COOKIE_SECRET in production.");
  }

  logger.warn("CART_COOKIE_SECRET is not set — using an insecure development-only fallback.");
  return DEV_ONLY_FALLBACK_SECRET;
}

function sign(orderNumber: string): string {
  return createHmac("sha256", getSecret()).update(orderNumber).digest("hex");
}

function encode(orderNumber: string): string {
  return `${orderNumber}.${sign(orderNumber)}`;
}

function decode(cookieValue: string): string | null {
  const separatorIndex = cookieValue.lastIndexOf(".");
  if (separatorIndex <= 0) return null;

  const orderNumber = cookieValue.slice(0, separatorIndex);
  const signature = cookieValue.slice(separatorIndex + 1);
  const expected = sign(orderNumber);

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }

  return orderNumber;
}

/** Sets the signed guest-order-access cookie right after a successful guest checkout. Only callable from a Server Action. */
export async function grantGuestOrderAccess(orderNumber: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(GUEST_ORDER_ACCESS_COOKIE_NAME, encode(orderNumber), {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: GUEST_ORDER_ACCESS_MAX_AGE_SECONDS,
  });
}

/** Verifies whether the current request's guest-order-access cookie grants access to exactly this order number. */
export async function hasGuestOrderAccess(orderNumber: string): Promise<boolean> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(GUEST_ORDER_ACCESS_COOKIE_NAME)?.value;
  if (!raw) return false;
  return decode(raw) === orderNumber;
}
