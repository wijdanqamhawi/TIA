"use server";

import { requireUser, UnauthenticatedError } from "@/lib/firebase/guards";
import {
  getProductById,
  isSelectedOptionValid,
  validateCartLineAvailability,
} from "@/lib/domain/catalog/product.service";
import { getOrCreateCart, saveCartItems, sameCartLine } from "@/lib/domain/cart/cart.service";
import { addItemToWishlist, removeItemFromWishlist } from "@/lib/domain/wishlist/wishlist.service";
import { wishlistItemSchema } from "@/lib/validation/wishlist.schema";
import { actionError, actionOk, actionValidationError, type ActionResult } from "@/lib/validation/common";
import type { CartItem } from "@/types/cart";

/**
 * Every wishlist action requires a verified, registered-customer session
 * (spec FR-033a) — there is no guest wishlist to fall back to. Returns a
 * clear `ActionResult` error rather than throwing, so a stale/expired
 * session on the client surfaces as a normal error the UI can react to
 * (e.g. redirecting to `/login`) instead of an unhandled Server Action
 * exception.
 */
async function requireWishlistUser() {
  try {
    return await requireUser();
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return null;
    }
    throw err;
  }
}

/**
 * `addWishlistItemAction` (T110, contracts/server-actions.md, "Wishlist"):
 * auth required; validates the product still exists and the selected
 * option (if any) is still real, then appends the entry — idempotent, a
 * duplicate add is a no-op rather than a second entry.
 */
export async function addWishlistItemAction(input: unknown): Promise<ActionResult<null>> {
  const claims = await requireWishlistUser();
  if (!claims) {
    return actionError("UNAUTHENTICATED", "Please sign in to use your wishlist.");
  }

  const parsed = wishlistItemSchema.safeParse(input);
  if (!parsed.success) {
    return actionValidationError(parsed.error);
  }

  const { productId, selectedOption = null } = parsed.data;

  const product = await getProductById(productId);
  if (!product) {
    return actionError("NOT_FOUND", "This product is no longer available.");
  }
  if (!isSelectedOptionValid(product, selectedOption)) {
    return actionError("INVALID_OPTION", "The selected option is no longer available.");
  }

  await addItemToWishlist(claims.uid, productId, selectedOption);
  return actionOk(null);
}

/** `removeWishlistItemAction` (T111): removes the matching entry, regardless of its current validity. */
export async function removeWishlistItemAction(input: unknown): Promise<ActionResult<null>> {
  const claims = await requireWishlistUser();
  if (!claims) {
    return actionError("UNAUTHENTICATED", "Please sign in to use your wishlist.");
  }

  const parsed = wishlistItemSchema.safeParse(input);
  if (!parsed.success) {
    return actionValidationError(parsed.error);
  }

  const { productId, selectedOption = null } = parsed.data;
  await removeItemFromWishlist(claims.uid, productId, selectedOption);
  return actionOk(null);
}

/**
 * `moveWishlistItemToCartAction` (T112): re-validates the product,
 * selected option, availability, and stock against **live** Firestore
 * data (never trusting whatever the wishlist page last displayed) before
 * adding to the cart. A Sold Out or otherwise unavailable/insufficient-
 * stock product is rejected here and **stays in the wishlist** — moving
 * to cart never silently removes an item it couldn't actually move (this
 * task's explicit requirement). Summing into an existing matching cart
 * line (same `productId` + `selectedOption`) mirrors `addCartItemAction`
 * exactly, so the two entry points can never diverge in behavior.
 */
export async function moveWishlistItemToCartAction(input: unknown): Promise<ActionResult<null>> {
  const claims = await requireWishlistUser();
  if (!claims) {
    return actionError("UNAUTHENTICATED", "Please sign in to use your wishlist.");
  }

  const parsed = wishlistItemSchema.safeParse(input);
  if (!parsed.success) {
    return actionValidationError(parsed.error);
  }

  const { productId, selectedOption = null } = parsed.data;

  const product = await getProductById(productId);
  if (!product) {
    return actionError("NOT_FOUND", "This product is no longer available.");
  }
  if (!isSelectedOptionValid(product, selectedOption)) {
    return actionError("INVALID_OPTION", "The selected option is no longer available.");
  }

  const { ref: cartRef, cart, isGuest } = await getOrCreateCart();
  const existingLine = cart.items.find((item) => sameCartLine(item, { productId, selectedOption }));
  const nextQuantity = (existingLine?.quantity ?? 0) + 1;

  const validation = validateCartLineAvailability(product, nextQuantity);
  if (!validation.ok) {
    return actionError(validation.reason, cartLineErrorMessage(validation.reason));
  }

  const nextCartItems: CartItem[] = existingLine
    ? cart.items.map((item) =>
        sameCartLine(item, { productId, selectedOption }) ? { ...item, quantity: nextQuantity } : item,
      )
    : [...cart.items, { productId, selectedOption, quantity: nextQuantity }];

  await saveCartItems(cartRef, nextCartItems, isGuest);
  await removeItemFromWishlist(claims.uid, productId, selectedOption);

  return actionOk(null);
}

function cartLineErrorMessage(reason: "NOT_AVAILABLE" | "SOLD_OUT" | "INSUFFICIENT_STOCK" | "INVALID_QUANTITY"): string {
  switch (reason) {
    case "SOLD_OUT":
      return "This product is sold out.";
    case "NOT_AVAILABLE":
      return "This product is no longer available.";
    case "INSUFFICIENT_STOCK":
      return "The requested quantity exceeds available stock.";
    case "INVALID_QUANTITY":
      return "Enter a valid quantity.";
  }
}
