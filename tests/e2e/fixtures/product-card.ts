import type { Locator, Page } from "@playwright/test";

/**
 * One product card (`ProductCard`'s `.group` root), located by the product's
 * exact name link — never "the first card".
 *
 * The seeded catalog includes with-options products (Aurelia Signature Cuff,
 * Classic Watch), and on those the card's Add to Cart opens Quick View and
 * its wishlist heart opens the detail page — by design, since a card has no
 * room for an option picker. Specs that exercise the card's *direct*
 * add/toggle behavior therefore target a no-options product by name, so the
 * result never depends on grid order (which changes with sort, merchandising
 * flags and new arrivals).
 */
export function productCard(scope: Page | Locator, name: string): Locator {
  const page = "page" in scope && typeof scope.page === "function" ? (scope as Locator).page() : (scope as Page);
  return scope
    .locator(".group")
    .filter({ has: page.getByRole("link", { name, exact: true }) })
    .first();
}
