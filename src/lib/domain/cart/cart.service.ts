import "server-only";
import type { DocumentReference } from "firebase-admin/firestore";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { cartsCollection, guestCartsCollection } from "@/lib/firebase/firestore";
import { getSessionClaims } from "@/lib/firebase/guards";
import { getOrCreateGuestCartId, readGuestCartId } from "./guest-cart";
import {
  getProductsByIds,
  isSelectedOptionValid,
  validateCartLineAvailability,
} from "@/lib/domain/catalog/product.service";
import { resolveOfferPricing, type OfferStatus } from "@/lib/domain/catalog/offer";
import type { Cart, CartItem, SelectedOption } from "@/types/cart";
import type { Product } from "@/types/product";
import type { LocalizedString } from "@/types/localizedString";

const GUEST_CART_TTL_MS = 30 * 24 * 60 * 60 * 1000; // ~30 days (data-model.md, research.md §5)

/** Two `CartItem`s address the same line iff productId AND selectedOption match exactly. */
export function sameCartLine(
  a: { productId: string; selectedOption: SelectedOption | null },
  b: { productId: string; selectedOption: SelectedOption | null },
): boolean {
  if (a.productId !== b.productId) return false;
  if (!a.selectedOption && !b.selectedOption) return true;
  if (!a.selectedOption || !b.selectedOption) return false;
  return a.selectedOption.optionKey === b.selectedOption.optionKey && a.selectedOption.valueKey === b.selectedOption.valueKey;
}

/**
 * Resolves the caller's cart document reference for a **mutation** —
 * `carts/{uid}` for a registered session, or `guestCarts/{guestCartId}`,
 * minting a new signed cookie if the caller has no guest cart yet
 * (contracts/server-actions.md, "Cart"). Only callable from a context
 * where cookies are mutable (Server Actions).
 */
export async function resolveCartRefForMutation(): Promise<{
  ref: DocumentReference<Cart>;
  isGuest: boolean;
}> {
  const claims = await getSessionClaims();
  if (claims) {
    return { ref: cartsCollection().doc(claims.uid), isGuest: false };
  }
  const guestCartId = await getOrCreateGuestCartId();
  return { ref: guestCartsCollection().doc(guestCartId), isGuest: true };
}

/** Read-only cart resolution for display (Server Components) — never mints a cookie. */
export async function getCartForDisplay(): Promise<Cart | null> {
  const claims = await getSessionClaims();

  if (claims) {
    const snapshot = await cartsCollection().doc(claims.uid).get();
    return snapshot.exists ? snapshot.data()! : null;
  }

  const guestCartId = await readGuestCartId();
  if (!guestCartId) return null;

  const snapshot = await guestCartsCollection().doc(guestCartId).get();
  return snapshot.exists ? snapshot.data()! : null;
}

/**
 * Get-or-create the caller's cart document (T098). Used by mutation
 * actions — an empty cart is created lazily on first write, not on mere
 * page views.
 */
export async function getOrCreateCart(): Promise<{ ref: DocumentReference<Cart>; cart: Cart; isGuest: boolean }> {
  const { ref, isGuest } = await resolveCartRefForMutation();
  const snapshot = await ref.get();

  if (snapshot.exists) {
    return { ref, cart: snapshot.data()!, isGuest };
  }

  const now = Timestamp.now();
  const cart: Cart = {
    id: ref.id,
    items: [],
    expiresAt: isGuest ? Timestamp.fromMillis(now.toMillis() + GUEST_CART_TTL_MS) : null,
    createdAt: now,
    updatedAt: now,
  };

  await ref.set({
    id: ref.id,
    items: cart.items,
    expiresAt: isGuest ? FieldValue.serverTimestamp() : null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { ref, cart, isGuest };
}

/** Persists an updated item list on an existing cart document reference. */
export async function saveCartItems(
  ref: DocumentReference<Cart>,
  items: CartItem[],
  isGuest: boolean,
): Promise<void> {
  await ref.update({
    items,
    updatedAt: FieldValue.serverTimestamp(),
    ...(isGuest ? { expiresAt: Timestamp.fromMillis(Date.now() + GUEST_CART_TTL_MS) } : {}),
  });
}

// --- Cart display enrichment (T102: server-side subtotal/total; never client-trusted) ---

export type CartLineIssue = "NOT_FOUND" | "NOT_AVAILABLE" | "SOLD_OUT" | "INSUFFICIENT_STOCK" | "INVALID_OPTION";

export type EnrichedCartLine = {
  productId: string;
  selectedOption: SelectedOption | null;
  quantity: number;
  issue: CartLineIssue | null;
  product: {
    slug: string;
    name: LocalizedString;
    image: Product["images"][number] | null;
    /** Live, current **effective** price (regular or active sale price) — never a stored/cart-cached value. */
    price: number;
    /** The regular/original price, for crossed-out display when `offerStatus === "ACTIVE"` (spec FR-118). */
    originalPrice: number;
    offerStatus: OfferStatus;
    stock: number;
    optionLabel: LocalizedString | null;
  } | null;
  /** `unitPrice * quantity`, only for a line with no `issue` — see cart page copy for why. */
  lineTotal: number;
};

export type CartSummary = {
  lines: EnrichedCartLine[];
  /** Sum of `lineTotal` across lines with no `issue` only — an invalid line is never silently priced in. */
  subtotal: number;
  total: number;
  hasIssues: boolean;
  isEmpty: boolean;
};

function resolveOptionLabel(product: Product, selectedOption: SelectedOption | null): LocalizedString | null {
  if (!selectedOption) return null;
  const option = product.options.find((o) => o.key === selectedOption.optionKey);
  const value = option?.values.find((v) => v.key === selectedOption.valueKey);
  return value?.label ?? null;
}

/**
 * Joins a cart's stored lines against **live** Firestore product data and
 * computes the subtotal/total server-side — the cart cookie/document never
 * stores a price, and no client-submitted total is ever trusted (spec:
 * "Price Security"). Every line is authoritatively re-validated
 * (availability/Sold Out/stock/selected option) using the exact same
 * checks Phase 5 already established (`validateCartLineAvailability`,
 * `isSelectedOptionValid`) — no separate, potentially-conflicting
 * inventory logic is introduced here.
 *
 * Pricing uses each product's current **effective** price via
 * `resolveOfferPricing` (Special Offers, spec FR-119/FR-120, SC-029) — the
 * same derivation `ProductCard`/Quick View/the product detail page use —
 * so a cart line always reflects the product's live offer state, never a
 * price captured whenever the item was originally added. Sold Out
 * (`validateCartLineAvailability`) is checked independently of, and always
 * overrides, any offer state (spec FR-122).
 */
export async function buildCartSummary(cart: Cart): Promise<CartSummary> {
  const products = await getProductsByIds(cart.items.map((item) => item.productId));

  const lines: EnrichedCartLine[] = cart.items.map((item) => {
    const product = products.get(item.productId);

    if (!product) {
      return { productId: item.productId, selectedOption: item.selectedOption, quantity: item.quantity, issue: "NOT_FOUND", product: null, lineTotal: 0 };
    }

    let issue: CartLineIssue | null = null;
    if (!isSelectedOptionValid(product, item.selectedOption)) {
      issue = "INVALID_OPTION";
    } else {
      const validation = validateCartLineAvailability(product, item.quantity);
      if (!validation.ok && validation.reason !== "INVALID_QUANTITY") {
        issue = validation.reason;
      }
    }

    const { offerStatus, effectivePrice } = resolveOfferPricing(product);
    const lineTotal = issue ? 0 : effectivePrice * item.quantity;

    return {
      productId: item.productId,
      selectedOption: item.selectedOption,
      quantity: item.quantity,
      issue,
      product: {
        slug: product.slug,
        name: product.name,
        image: product.images[0] ?? null,
        price: effectivePrice,
        originalPrice: product.price,
        offerStatus,
        stock: product.stock,
        optionLabel: resolveOptionLabel(product, item.selectedOption),
      },
      lineTotal,
    };
  });

  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);

  return {
    lines,
    subtotal,
    total: subtotal, // no shipping/discount/tax computation exists yet — total mirrors subtotal
    hasIssues: lines.some((line) => line.issue !== null),
    isEmpty: lines.length === 0,
  };
}
