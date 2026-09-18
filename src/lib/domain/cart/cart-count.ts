import "server-only";
import { getCartForDisplay } from "./cart.service";

/**
 * The shopper's total cart quantity for the navbar badge — the sum of every
 * line's `quantity`, not the number of distinct lines, so two of one product
 * and three of another reads as 5.
 *
 * Deliberately reuses `getCartForDisplay()`, the same read-only resolution
 * the cart page itself uses: it resolves `carts/{uid}` for a signed-in
 * shopper and the signed guest-cart cookie otherwise, and never mints a
 * cookie or creates a document just because a page was viewed. There is no
 * second cart state and no new persistence here — only a projection of the
 * existing one.
 *
 * Returns 0 when there is no cart at all, which is the common case for a
 * first-time visitor and the case where the badge must not render.
 */
export async function getCartItemCount(): Promise<number> {
  const cart = await getCartForDisplay();
  if (!cart) return 0;
  return cart.items.reduce((total, item) => total + item.quantity, 0);
}
