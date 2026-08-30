"use server";

import { getProductById, isSelectedOptionValid, validateCartLineAvailability } from "@/lib/domain/catalog/product.service";
import { getOrCreateCart, saveCartItems, sameCartLine } from "@/lib/domain/cart/cart.service";
import { addCartItemSchema, cartItemSchema, removeCartItemSchema } from "@/lib/validation/cart.schema";
import { actionError, actionOk, actionValidationError, type ActionResult } from "@/lib/validation/common";
import type { CartItem } from "@/types/cart";

/**
 * `addCartItemAction` (contracts/server-actions.md, "Cart", T099):
 * validates input, resolves the caller's `carts/{uid}`/`guestCarts/{id}`
 * document (creating one and setting the cookie if absent), loads the
 * authoritative product, rejects a hidden/Sold-Out/over-quantity/invalid-
 * option request, and upserts the line — summing into an existing
 * matching line (same `productId` + `selectedOption`) rather than adding
 * a duplicate. Behaves identically regardless of the caller's language.
 */
export async function addCartItemAction(input: unknown): Promise<ActionResult<{ quantity: number }>> {
  const parsed = addCartItemSchema.safeParse(input);
  if (!parsed.success) {
    return actionValidationError(parsed.error);
  }

  const { productId, selectedOption = null, quantity } = parsed.data;

  const product = await getProductById(productId);
  if (!product) {
    return actionError("NOT_FOUND", "This product is no longer available.");
  }

  if (!isSelectedOptionValid(product, selectedOption)) {
    return actionError("INVALID_OPTION", "The selected option is no longer available.");
  }

  const { ref, cart, isGuest } = await getOrCreateCart();
  const existingLine = cart.items.find((item) => sameCartLine(item, { productId, selectedOption }));
  const nextQuantity = (existingLine?.quantity ?? 0) + quantity;

  const validation = validateCartLineAvailability(product, nextQuantity);
  if (!validation.ok) {
    return actionError(validation.reason, cartLineErrorMessage(validation.reason));
  }

  const nextItems: CartItem[] = existingLine
    ? cart.items.map((item) =>
        sameCartLine(item, { productId, selectedOption }) ? { ...item, quantity: nextQuantity } : item,
      )
    : [...cart.items, { productId, selectedOption, quantity: nextQuantity }];

  await saveCartItems(ref, nextItems, isGuest);

  return actionOk({ quantity: nextQuantity });
}

/**
 * `updateCartItemQuantityAction` (T100): same stock/Sold-Out/option
 * re-validation as `addCartItemAction`; sets the line to the requested
 * quantity outright (not additive); `quantity <= 0` removes the line.
 */
export async function updateCartItemQuantityAction(input: unknown): Promise<ActionResult<null>> {
  const parsed = cartItemSchema.safeParse(input);
  if (!parsed.success) {
    return actionValidationError(parsed.error);
  }

  const { productId, selectedOption = null, quantity } = parsed.data;
  const { ref, cart, isGuest } = await getOrCreateCart();

  if (quantity <= 0) {
    const nextItems = cart.items.filter((item) => !sameCartLine(item, { productId, selectedOption }));
    await saveCartItems(ref, nextItems, isGuest);
    return actionOk(null);
  }

  const product = await getProductById(productId);
  if (!product) {
    return actionError("NOT_FOUND", "This product is no longer available.");
  }
  if (!isSelectedOptionValid(product, selectedOption)) {
    return actionError("INVALID_OPTION", "The selected option is no longer available.");
  }

  const validation = validateCartLineAvailability(product, quantity);
  if (!validation.ok) {
    return actionError(validation.reason, cartLineErrorMessage(validation.reason));
  }

  const lineExists = cart.items.some((item) => sameCartLine(item, { productId, selectedOption }));
  const nextItems: CartItem[] = lineExists
    ? cart.items.map((item) =>
        sameCartLine(item, { productId, selectedOption }) ? { ...item, quantity } : item,
      )
    : [...cart.items, { productId, selectedOption, quantity }];

  await saveCartItems(ref, nextItems, isGuest);
  return actionOk(null);
}

/** `removeCartItemAction` (T101): removes the matching line, regardless of its current validity. */
export async function removeCartItemAction(input: unknown): Promise<ActionResult<null>> {
  const parsed = removeCartItemSchema.safeParse(input);
  if (!parsed.success) {
    return actionValidationError(parsed.error);
  }

  const { productId, selectedOption = null } = parsed.data;
  const { ref, cart, isGuest } = await getOrCreateCart();

  const nextItems = cart.items.filter((item) => !sameCartLine(item, { productId, selectedOption }));
  await saveCartItems(ref, nextItems, isGuest);

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
