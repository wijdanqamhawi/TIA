import { test, expect } from "./fixtures/base";
import { resetSeededStock } from "./fixtures/catalog-reset";
import { selectShopCategory, shopSearchBox } from "./fixtures/shop-filters";
import { switchToArabicWithAvailableControl } from "./fixtures/language";

/**
 * Guest browses Home (all four showcases) → Shop → category page →
 * product detail (quickstart Scenario 1/1b/12). Requires the Firebase
 * Local Emulator Suite running with `scripts/seed.ts` already applied.
 */
test.describe("guest browsing", () => {
  // Read-only browsing, but reset defensively anyway: this suite's
  // assertions target a specific seeded product by name, and another spec
  // file's real checkout could otherwise have changed its Sold Out state.
  test.beforeAll(async () => {
    await resetSeededStock(["golden-bangle-bracelet"]);
  });

  test("homepage shows the four category showcases and merchandising sections", async ({ page }) => {
    await page.goto("/en");

    // Scoped to the hero's `h1`: the brand-statement band further down the
    // page carries the same phrase as its own `h2`.
    await expect(page.getByRole("heading", { name: "More than accessories", level: 1 })).toBeVisible();
    const main = page.getByRole("main");
    await expect(main.getByRole("link", { name: "Shop Now" })).toHaveAttribute("href", /\/en\/shop$/);

    // The approved homepage composition (see `(storefront)/page.tsx`): a
    // New Arrivals row of real products, then "Shop by Category" with one
    // tile per category. Best Sellers and the per-category showcase grid are
    // deliberately not part of it any more.
    await expect(main.getByRole("heading", { name: "New Arrivals", level: 2 })).toBeVisible();
    // The newest seeded New Arrival — the row is `createdAt`-descending and
    // the seed now carries more in-stock New Arrivals than the row shows.
    await expect(main.getByRole("link", { name: "Luna Mesh Watch" }).first()).toBeVisible();
    await expect(main.getByRole("heading", { name: "Shop by Category", level: 2 })).toBeVisible();
    for (const [name, slug] of [
      ["Bracelets", "bracelets"],
      ["Rings", "rings"],
      ["Earrings", "earrings"],
      ["Watches", "watches"],
    ]) {
      await expect(main.getByRole("link", { name, exact: true })).toHaveAttribute(
        "href",
        new RegExp(`/en/shop/category/${slug}$`),
      );
    }
  });

  test("Home -> Shop -> category page -> product detail", async ({ page }) => {
    await page.goto("/en");

    await page.getByRole("link", { name: "Shop", exact: true }).first().click();
    await expect(page).toHaveURL(/\/en\/shop$/);
    await expect(page.getByRole("heading", { name: "All Accessories", level: 1 })).toBeVisible();

    // The Shop page now filters by category in place rather than linking to
    // the dedicated category route. Below `lg` that control lives in the
    // filter drawer rather than the sidebar, so it has to be opened first
    // (see fixtures/shop-filters.ts). The category route itself still
    // exists and is covered by its own test below.
    await expect(async () => {
      await selectShopCategory(page, "Bracelets");
      await expect(page).toHaveURL(/\/en\/shop\?category=bracelets$/, { timeout: 10000 });
    }).toPass({ timeout: 40000 });

    const main = page.getByRole("main");
    await expect(main.getByRole("link", { name: "Golden Bangle Bracelet" }).first()).toBeVisible();
    await expect(main.getByRole("link", { name: "Solitaire Ring" })).toHaveCount(0);

    await main.getByRole("link", { name: "Golden Bangle Bracelet" }).first().click();
    await expect(page).toHaveURL(/\/en\/shop\/golden-bangle-bracelet$/);
    await expect(page.getByRole("heading", { name: "Golden Bangle Bracelet", level: 1 })).toBeVisible();
    await expect(page.getByText("18k Gold-Plated Brass")).toBeVisible();
  });

  test("search and sort controls update the Shop page results", async ({ page }) => {
    await page.goto("/en/shop");

    // Retry the interaction: on a slower engine (WebKit/iPad), a click
    // landing before client-side hydration completes hits inert
    // server-rendered markup with no event handlers attached yet. Below
    // `lg` the search box is in the filter drawer, not the sidebar — the
    // helper opens it (and re-opens it on a retry, since submitting
    // navigates and closes it).
    await expect(async () => {
      const searchInput = await shopSearchBox(page);
      await searchInput.fill("watch");
      await searchInput.press("Enter");
      await expect(page).toHaveURL(/q=watch/, { timeout: 10000 });
    }).toPass({ timeout: 40000 });
    // Search matches whole keyword tokens (searchTokens.ts): "watch" is a
    // token of the seeded "Classic Watch" only.
    const main = page.getByRole("main");
    await expect(main.getByRole("link", { name: "Classic Watch" }).first()).toBeVisible();
    await expect(main.getByRole("link", { name: "Golden Bangle Bracelet" })).toHaveCount(0);
  });

  test("language switcher renders Arabic RTL content", async ({ page }) => {
    await page.goto("/en");

    // The one visible language control at every viewport: the welcome
    // screen's EN | AR (the header and the menu carry none).
    await switchToArabicWithAvailableControl(page);
    await expect(page).toHaveURL(/\/ar$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    // The category name now legitimately appears as a heading twice on the
    // homepage — once in the Collections row and once on that category's
    // own editorial showcase banner — so this scopes to the first.
    await expect(page.getByRole("heading", { name: "أساور", exact: true }).first()).toBeVisible();
  });
});
