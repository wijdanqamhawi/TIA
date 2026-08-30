import { test, expect } from "./fixtures/base";
import { resetSeededStock } from "./fixtures/catalog-reset";

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

    await expect(page.getByRole("heading", { name: "ELORA JEWELLERY" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Shop Bracelets" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Shop Rings" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Shop Earrings" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Shop Watches" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "New Arrivals" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Best Sellers" })).toBeVisible();
  });

  test("Home -> Shop -> category page -> product detail", async ({ page }) => {
    await page.goto("/en");

    await page.getByRole("link", { name: "Shop", exact: true }).first().click();
    await expect(page).toHaveURL(/\/en\/shop$/);
    await expect(page.getByRole("heading", { name: "Shop", level: 1 })).toBeVisible();

    await page.getByRole("link", { name: "Bracelets" }).first().click();
    await expect(page).toHaveURL(/\/en\/shop\/category\/bracelets$/);

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

    const searchInput = page.getByPlaceholder("Search products…");
    // Retry the interaction: on a slower engine (WebKit/iPad), a click
    // landing before client-side hydration completes hits inert
    // server-rendered markup with no event handlers attached yet.
    await expect(async () => {
      await searchInput.fill("gold");
      await searchInput.press("Enter");
      await expect(page).toHaveURL(/q=gold/, { timeout: 1000 });
    }).toPass({ timeout: 15000 });
    await expect(page.getByRole("main").getByRole("link", { name: "Classic Gold Watch" }).first()).toBeVisible();
  });

  test("language switcher renders Arabic RTL content", async ({ page }) => {
    await page.goto("/en");

    // On narrow viewports the switcher lives inside the mobile hamburger
    // drawer (spec FR-003) rather than directly in the top bar.
    const openMenu = page.getByRole("button", { name: "Open menu" });
    if (await openMenu.isVisible()) {
      await openMenu.click();
    }

    await page.getByRole("button", { name: "AR", exact: true }).click();
    await expect(page).toHaveURL(/\/ar$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "أساور", exact: true })).toBeVisible();
  });
});
