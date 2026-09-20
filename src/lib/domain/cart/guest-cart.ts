import "server-only";
import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { logger } from "@/lib/utils/logger";
import { cookieSecure } from "@/lib/config/cookies";

export const GUEST_CART_COOKIE_NAME = "__guest_cart";
const GUEST_CART_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // ~30 days, mirrors `guestCarts.expiresAt`

const DEV_ONLY_FALLBACK_SECRET = "dev-only-insecure-guest-cart-secret";

function getSecret(): string {
  const secret = process.env.CART_COOKIE_SECRET;
  if (secret) return secret;

  if (process.env.NODE_ENV === "production") {
    throw new Error("Missing CART_COOKIE_SECRET in production.");
  }

  logger.warn("CART_COOKIE_SECRET is not set — using an insecure development-only fallback.");
  return DEV_ONLY_FALLBACK_SECRET;
}

function sign(id: string): string {
  return createHmac("sha256", getSecret()).update(id).digest("hex");
}

/**
 * Encodes an opaque `guestCartId` into a signed cookie value
 * (`<id>.<hmac>`). The cookie carries only this identifier — never price
 * or item data (research.md §5) — so the client can never tamper with
 * cart contents, and cannot forge a value pointing at another guest's
 * cart without knowing the server secret.
 */
function encode(guestCartId: string): string {
  return `${guestCartId}.${sign(guestCartId)}`;
}

/** Verifies a cookie value's signature and returns the `guestCartId`, or `null` if invalid/tampered. */
function decode(cookieValue: string): string | null {
  const separatorIndex = cookieValue.lastIndexOf(".");
  if (separatorIndex <= 0) return null;

  const id = cookieValue.slice(0, separatorIndex);
  const signature = cookieValue.slice(separatorIndex + 1);
  const expected = sign(id);

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }

  return id;
}

function generateGuestCartId(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * Reads the current request's verified `guestCartId`, if any. Never
 * trusts an unsigned or tampered cookie value.
 */
export async function readGuestCartId(): Promise<string | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(GUEST_CART_COOKIE_NAME)?.value;
  if (!raw) return null;
  return decode(raw);
}

/**
 * Returns the current request's `guestCartId`, minting and setting a new
 * signed cookie if none exists yet (or the existing one failed
 * verification). Only callable from a context where cookies are mutable
 * (Server Actions / Route Handlers) — a plain Server Component's cookies()
 * is read-only.
 */
export async function getOrCreateGuestCartId(): Promise<string> {
  const existing = await readGuestCartId();
  if (existing) return existing;

  const guestCartId = generateGuestCartId();
  const cookieStore = await cookies();
  cookieStore.set(GUEST_CART_COOKIE_NAME, encode(guestCartId), {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: GUEST_CART_MAX_AGE_SECONDS,
  });

  return guestCartId;
}

/** Clears the guest-cart cookie (called after a successful guest→registered merge, T103). */
export async function clearGuestCartCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(GUEST_CART_COOKIE_NAME);
}
