import type { WishlistSelectedOption } from "@/types/wishlist";

/**
 * Guest "Add to Wishlist" intent preservation (spec FR-033a, research.md
 * §7, T113/T114): a guest is never given a temporary wishlist — instead
 * the intended action is encoded into a stable string carried through
 * `/login?next=<path>&intent=<this>`, and completed server-side inside
 * `createSessionAction` right after a successful sign-in/sign-up.
 *
 * Deliberately has NO `server-only` import so both the client (building
 * the intent string before redirecting to `/login`) and the server
 * (`createSessionAction`, parsing it after authentication) can import
 * this exact module — mirrors `soldOut.ts`/`offer.ts`.
 *
 * Format: `wishlist:<productId>` or, when a specific option was selected,
 * `wishlist:<productId>:<optionKey>:<valueKey>`.
 */

export type WishlistIntent = {
  productId: string;
  selectedOption: WishlistSelectedOption | null;
};

const STABLE_ID = "[a-zA-Z0-9_-]+";
const INTENT_PATTERN = new RegExp(`^wishlist:(${STABLE_ID})(?::(${STABLE_ID}):(${STABLE_ID}))?$`);

/** Builds the intent string for a guest "Add to Wishlist" redirect. */
export function buildWishlistIntent(productId: string, selectedOption: WishlistSelectedOption | null): string {
  return selectedOption
    ? `wishlist:${productId}:${selectedOption.optionKey}:${selectedOption.valueKey}`
    : `wishlist:${productId}`;
}

/**
 * Parses (and structurally validates) an `intent` query parameter.
 * Returns `null` for anything malformed/absent/not a wishlist intent —
 * never throws, since this runs on every sign-in regardless of whether an
 * intent was actually present (most sign-ins have none).
 */
export function parseWishlistIntent(intent: string | null | undefined): WishlistIntent | null {
  if (!intent) return null;
  const match = INTENT_PATTERN.exec(intent);
  if (!match) return null;

  const [, productId, optionKey, valueKey] = match;
  return {
    productId,
    selectedOption: optionKey && valueKey ? { optionKey, valueKey } : null,
  };
}
