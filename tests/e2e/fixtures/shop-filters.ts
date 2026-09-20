import { expect, type Locator, type Page } from "@playwright/test";

/**
 * The Shop page's filter controls, at any viewport.
 *
 * `ShopFilters` is rendered twice by `ShopToolbar`/the shop page: as a
 * sidebar from `lg` up, and — below that — inside a drawer behind the
 * "Filters" button. Only one of the two is ever in the accessibility tree,
 * so a spec that reaches straight for the search box or a category button
 * finds nothing on a phone or tablet. These helpers open the drawer when
 * that is where the controls live, and do nothing when the sidebar is
 * already on screen.
 */

const FILTERS_TRIGGER = /^(Filters|التصفية)$/;

/** Makes the filter controls reachable, whichever of the two is rendered. */
export async function openShopFilters(page: Page): Promise<void> {
  const search = page.getByRole("searchbox").first();
  if (await search.isVisible().catch(() => false)) return;
  await page.getByRole("button", { name: FILTERS_TRIGGER }).first().click();
  await expect(search).toBeVisible({ timeout: 15_000 });
}

/** The Shop page's search box, with the drawer opened first if it is behind one. */
export async function shopSearchBox(page: Page): Promise<Locator> {
  await openShopFilters(page);
  return page.getByRole("searchbox").first();
}

/** Filters the Shop page by a category, by its localized name. */
export async function selectShopCategory(page: Page, name: string): Promise<void> {
  await openShopFilters(page);
  await page.getByRole("button", { name, exact: true }).first().click();
}
