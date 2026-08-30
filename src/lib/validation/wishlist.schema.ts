import { z } from "zod";
import { selectedOptionSchema } from "./cart.schema";

/**
 * Input to `addWishlistItemAction`/`removeWishlistItemAction`/
 * `moveWishlistItemToCartAction` (contracts/server-actions.md,
 * "Wishlist"). Reuses `selectedOptionSchema` from `cart.schema.ts` —
 * wishlist option selection is validated identically to cart option
 * selection (a pair of stable identifiers, never a localized label,
 * re-verified server-side against the product's real `options`,
 * Constitution Principle 13).
 */
export const wishlistItemSchema = z.object({
  productId: z.string().trim().min(1, "productId is required."),
  selectedOption: selectedOptionSchema.nullable().optional(),
});
export type WishlistItemInput = z.infer<typeof wishlistItemSchema>;
