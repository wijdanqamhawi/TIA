import { z } from "zod";
import { stableId } from "./common";

export const selectedOptionSchema = z.object({
  optionKey: stableId,
  valueKey: stableId,
});

/**
 * `cartItemSchema` (contracts/server-actions.md, "Cart"): `quantity` must
 * be a positive integer; `selectedOption`, when present, is a pair of
 * stable identifiers — never a localized label string — re-verified
 * server-side against the product's real `options` before any write
 * (Constitution Principle 13).
 */
export const cartItemSchema = z.object({
  productId: z.string().trim().min(1, "productId is required."),
  selectedOption: selectedOptionSchema.nullable().optional(),
  quantity: z.number().int("Quantity must be a whole number."),
});
export type CartItemInput = z.infer<typeof cartItemSchema>;

/** `addCartItemAction`/`updateCartItemQuantityAction` require a positive quantity to add/set. */
export const addCartItemSchema = cartItemSchema.extend({
  quantity: z.number().int().positive("Quantity must be at least 1."),
});
export type AddCartItemInput = z.infer<typeof addCartItemSchema>;

/** `removeCartItemAction` needs only enough to identify the line. */
export const removeCartItemSchema = cartItemSchema.pick({ productId: true, selectedOption: true });
export type RemoveCartItemInput = z.infer<typeof removeCartItemSchema>;
