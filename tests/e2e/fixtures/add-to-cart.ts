import { expect, type Locator, type Page } from "@playwright/test";
import { productCard } from "./product-card";

/**
 * Adding to the cart, without the double-add.
 *
 * Every "Add to Cart" in this suite goes through a Server Action, and on the
 * dev server that action can legitimately take several seconds. The obvious
 * `expect(async () => { click; assert }).toPass()` is wrong for it: the
 * click is not idempotent, so a too-short inner assertion makes the retry
 * click *again* and the cart quietly ends up with 2, 3, 8 units — which is
 * how `cart.spec.ts` came to look for a quantity of "2" in a cart holding 8.
 * Clicking exactly once and then waiting is not safe either: a click that
 * lands before hydration hits inert markup, and nothing ever happens.
 *
 * These helpers close both: they retry, but they re-click only while the
 * cart still has not changed, and they read that from the header cart
 * link's own accessible name ("Cart" / "Cart, 3 items"), which the Server
 * Action's revalidation updates — the storefront's own evidence that the
 * mutation landed, in either language.
 */

/** The header cart link's accessible name — the shopper-visible cart state. */
export async function cartLabel(page: Page): Promise<string> {
  const link = page.getByRole("banner").getByRole("link", { name: /Cart|السلة/ }).first();
  return (await link.getAttribute("aria-label")) ?? "";
}

async function clickUntilCartChanges(page: Page, button: Locator): Promise<void> {
  const before = await cartLabel(page);
  await expect(button).toBeEnabled({ timeout: 30_000 });
  await expect(async () => {
    if ((await cartLabel(page)) === before) {
      await button.click();
      // Inside the retry on purpose: if this wait runs out the outer
      // `toPass` re-checks the cart first and only clicks again if the
      // previous click really did nothing.
      await expect.poll(() => cartLabel(page), { timeout: 10_000 }).not.toBe(before);
    }
  }).toPass({ timeout: 45_000 });
}

/**
 * Adds one unit of `name` from a product grid (the card's own Add to Cart).
 *
 * Always by product name, never "the first card": a with-options product's
 * card opens Quick View instead of adding (see `product-card.ts`), and grid
 * order changes with sort, merchandising flags and new arrivals.
 */
export async function addCardToCart(page: Page, name: string): Promise<void> {
  const card = productCard(page.getByRole("main"), name);
  await clickUntilCartChanges(page, card.getByRole("button", { name: /Add to Cart|أضف إلى السلة/ }));
}

/**
 * Adds one unit from a product *detail* page's purchase panel. Two Add to
 * Cart buttons legitimately render there (the panel's own and the sticky
 * mobile bar), so this takes the first — they are the same action.
 */
export async function addDetailToCart(page: Page): Promise<void> {
  const button = page
    .getByRole("main")
    .getByRole("button", { name: /Add to Cart|أضف إلى السلة/ })
    .first();
  await clickUntilCartChanges(page, button);
}
