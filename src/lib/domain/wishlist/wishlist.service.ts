import "server-only";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { wishlistsCollection } from "@/lib/firebase/firestore";
import { getSessionClaims } from "@/lib/firebase/guards";
import { getProductsByIds, isSelectedOptionValid } from "@/lib/domain/catalog/product.service";
import { isSoldOut } from "@/lib/domain/catalog/soldOut";
import { resolveOfferPricing, type OfferStatus } from "@/lib/domain/catalog/offer";
import type { Wishlist, WishlistItem, WishlistSelectedOption } from "@/types/wishlist";
import type { Product } from "@/types/product";
import type { LocalizedString } from "@/types/localizedString";

/** Two `WishlistItem`s address the same entry iff productId AND selectedOption match exactly (mirrors `sameCartLine`). */
export function sameWishlistItem(
  a: { productId: string; selectedOption: WishlistSelectedOption | null },
  b: { productId: string; selectedOption: WishlistSelectedOption | null },
): boolean {
  if (a.productId !== b.productId) return false;
  if (!a.selectedOption && !b.selectedOption) return true;
  if (!a.selectedOption || !b.selectedOption) return false;
  return a.selectedOption.optionKey === b.selectedOption.optionKey && a.selectedOption.valueKey === b.selectedOption.valueKey;
}

/** Read-only wishlist resolution for display (Server Components) — `null` for a guest or a customer with no wishlist yet. */
export async function getWishlistForDisplay(): Promise<Wishlist | null> {
  const claims = await getSessionClaims();
  if (!claims) return null;

  const snapshot = await wishlistsCollection().doc(claims.uid).get();
  return snapshot.exists ? snapshot.data()! : null;
}

/**
 * The set of `productId`s currently on the signed-in customer's wishlist
 * (an entry with a `null` `selectedOption` — the only shape a `ProductCard`
 * ever adds/removes, since a grid card has no option picker, T072/T113) —
 * empty for a guest or a customer with no wishlist yet. Built directly on
 * top of `getWishlistForDisplay()` (never a second Firestore read/query),
 * so every consumer of "is this product on my wishlist" shares the exact
 * same source of truth as the `/wishlist` page itself.
 */
export async function getWishlistedProductIds(): Promise<Set<string>> {
  const wishlist = await getWishlistForDisplay();
  if (!wishlist) return new Set();
  return new Set(wishlist.items.filter((item) => item.selectedOption === null).map((item) => item.productId));
}

/**
 * Idempotently appends an item to `uid`'s wishlist (creating the document
 * if it doesn't exist yet) — a no-op if the exact same `productId` +
 * `selectedOption` is already present. Callers (the Server Action, and
 * `createSessionAction`'s guest-intent completion) are responsible for
 * their own authentication/product/option validation before calling this;
 * this function trusts `uid` completely, so it must never be derived from
 * anything other than a verified session (Constitution Principle 6).
 */
export async function addItemToWishlist(
  uid: string,
  productId: string,
  selectedOption: WishlistSelectedOption | null,
): Promise<void> {
  const ref = wishlistsCollection().doc(uid);
  const snapshot = await ref.get();
  const items = snapshot.exists ? snapshot.data()!.items : [];

  if (items.some((item) => sameWishlistItem(item, { productId, selectedOption }))) {
    return;
  }

  const nextItems: WishlistItem[] = [...items, { productId, selectedOption, addedAt: Timestamp.now() }];

  if (snapshot.exists) {
    await ref.update({ items: nextItems, updatedAt: FieldValue.serverTimestamp() });
  } else {
    await ref.set({
      id: uid,
      items: nextItems,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
}

/** Removes the matching entry, if any — a no-op if it's already absent or the wishlist doesn't exist. */
export async function removeItemFromWishlist(
  uid: string,
  productId: string,
  selectedOption: WishlistSelectedOption | null,
): Promise<void> {
  const ref = wishlistsCollection().doc(uid);
  const snapshot = await ref.get();
  if (!snapshot.exists) return;

  const nextItems = snapshot.data()!.items.filter((item) => !sameWishlistItem(item, { productId, selectedOption }));
  await ref.update({ items: nextItems, updatedAt: FieldValue.serverTimestamp() });
}

// --- Wishlist display enrichment (mirrors cart.service.ts's buildCartSummary) ---

export type WishlistLineIssue = "NOT_FOUND" | "INVALID_OPTION";

export type EnrichedWishlistItem = {
  productId: string;
  selectedOption: WishlistSelectedOption | null;
  issue: WishlistLineIssue | null;
  product: {
    slug: string;
    name: LocalizedString;
    image: Product["images"][number] | null;
    /** Live, current **effective** price (regular or active sale price) — never stored on the wishlist item. */
    price: number;
    originalPrice: number;
    offerStatus: OfferStatus;
    stock: number;
    availability: boolean;
    isSoldOut: boolean;
    optionLabel: LocalizedString | null;
  } | null;
};

export type WishlistSummary = {
  items: EnrichedWishlistItem[];
  isEmpty: boolean;
};

function resolveOptionLabel(product: Product, selectedOption: WishlistSelectedOption | null): LocalizedString | null {
  if (!selectedOption) return null;
  const option = product.options.find((o) => o.key === selectedOption.optionKey);
  const value = option?.values.find((v) => v.key === selectedOption.valueKey);
  return value?.label ?? null;
}

/**
 * Joins a wishlist's stored entries against **live** Firestore product
 * data — never a stored price/stock/availability (spec FR-032, this
 * task's explicit requirement). A product that no longer exists, or whose
 * selected option no longer exists, is flagged via `issue` but never
 * silently dropped — the customer can still see and remove the entry
 * (mirrors `buildCartSummary`'s NOT_FOUND/INVALID_OPTION handling).
 * Newest-added first.
 */
export async function buildWishlistSummary(wishlist: Wishlist): Promise<WishlistSummary> {
  const sortedEntries = [...wishlist.items].sort((a, b) => b.addedAt.toMillis() - a.addedAt.toMillis());
  const products = await getProductsByIds(sortedEntries.map((item) => item.productId));

  const items: EnrichedWishlistItem[] = sortedEntries.map((item) => {
    const product = products.get(item.productId);

    if (!product) {
      return { productId: item.productId, selectedOption: item.selectedOption, issue: "NOT_FOUND", product: null };
    }

    const optionValid = isSelectedOptionValid(product, item.selectedOption);
    const { offerStatus, effectivePrice } = resolveOfferPricing(product);

    return {
      productId: item.productId,
      selectedOption: item.selectedOption,
      issue: optionValid ? null : "INVALID_OPTION",
      product: {
        slug: product.slug,
        name: product.name,
        image: product.images[0] ?? null,
        price: effectivePrice,
        originalPrice: product.price,
        offerStatus,
        stock: product.stock,
        availability: product.availability,
        isSoldOut: isSoldOut(product),
        optionLabel: resolveOptionLabel(product, item.selectedOption),
      },
    };
  });

  return { items, isEmpty: items.length === 0 };
}
