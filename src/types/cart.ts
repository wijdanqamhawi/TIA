import type { Timestamp } from "firebase-admin/firestore";

export type SelectedOption = {
  optionKey: string;
  valueKey: string;
};

/**
 * Embedded cart line (data-model.md `CartItem`). `selectedOption`
 * references the product's stable, language-independent `options[].key`/
 * `values[].key` — never a localized label — so a line's identity/
 * selection never changes when the shopper switches language.
 */
export type CartItem = {
  productId: string;
  selectedOption: SelectedOption | null;
  quantity: number;
};

/**
 * Shared shape for `carts/{uid}` and `guestCarts/{guestCartId}`
 * (data-model.md). `expiresAt` is present on `guestCarts` documents only —
 * the field a Firestore TTL policy targets (research.md §5) — never on a
 * registered customer's `carts/{uid}` document.
 */
export type Cart = {
  id: string; // uid for `carts`, opaque guestCartId for `guestCarts`
  items: CartItem[];
  expiresAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
