import type { Timestamp } from "firebase-admin/firestore";

export type WishlistSelectedOption = {
  optionKey: string;
  valueKey: string;
};

/**
 * A single `wishlists/{uid}` entry (data-model.md, resolving the prior
 * "Not yet pinned down" ambiguity, spec User Story 3). Deliberately
 * carries **no** `quantity`, `price`, `stock`, or `availability` — those
 * are never stored on a wishlist item and are always read live from
 * `products/{productId}` at display/move-to-cart time (spec FR-032,
 * Constitution Principle 10), exactly like Cart never stores a price.
 *
 * `selectedOption` mirrors `CartItem.selectedOption` exactly (a single
 * `{ optionKey, valueKey }` pair, not an array) — the catalog's option
 * model supports only one option dimension per product (data-model.md,
 * `carts/{uid}`), so a wishlist entry needs no more than Cart already
 * needs for the same product.
 */
export type WishlistItem = {
  productId: string;
  selectedOption: WishlistSelectedOption | null;
  /** When this item was added — used only for display ordering (newest first), never shown as a stored price/stock proxy. */
  addedAt: Timestamp;
};

/**
 * `wishlists/{uid}` (data-model.md). Document ID is the Firebase Auth
 * `uid` — registered-customer-only, no guest variant exists (spec
 * FR-033a); there is deliberately no `guestWishlists` collection
 * mirroring `guestCarts`.
 */
export type Wishlist = {
  id: string; // mirrors uid
  items: WishlistItem[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
