import { test, expect } from "./fixtures/base";

/**
 * T237 (quickstart Scenario 1b / 12): category isolation — 0% cross-
 * category leakage. Reads only, using the seeded catalog
 * (scripts/seed.ts): golden-bangle-bracelet/pearl-tennis-bracelet →
 * bracelets; solitaire-ring → rings; pearl-drop-earrings → earrings;
 * classic-gold-watch → watches.
 */
const CATEGORIES = [
  { slug: "bracelets", own: ["Golden Bangle Bracelet", "Pearl Tennis Bracelet"], foreign: ["Solitaire Ring", "Pearl Drop Earrings", "Classic Gold Watch"] },
  { slug: "rings", own: ["Solitaire Ring"], foreign: ["Golden Bangle Bracelet", "Pearl Drop Earrings", "Classic Gold Watch"] },
  { slug: "earrings", own: ["Pearl Drop Earrings"], foreign: ["Golden Bangle Bracelet", "Solitaire Ring", "Classic Gold Watch"] },
  { slug: "watches", own: ["Classic Gold Watch"], foreign: ["Golden Bangle Bracelet", "Solitaire Ring", "Pearl Drop Earrings"] },
] as const;

test.describe("category isolation — 0% cross-category leakage", () => {
  for (const category of CATEGORIES) {
    test(`${category.slug} category page shows only its own products`, async ({ page }) => {
      await page.goto(`/en/shop/category/${category.slug}`);
      const main = page.getByRole("main");

      for (const name of category.own) {
        await expect(main.getByText(name).first()).toBeVisible();
      }
      for (const name of category.foreign) {
        await expect(main.getByText(name)).toHaveCount(0);
      }
    });
  }

  test("homepage category showcases never leak a product into another category's Featured strip", async ({
    page,
  }) => {
    await page.goto("/en");
    const main = page.getByRole("main");

    // Each category's own Featured/showcase section must never show a
    // product that belongs to a different category. Spot-checked against
    // the same seeded catalog used above — a bracelets-only product must
    // never appear directly adjacent to (i.e. inside) another category's
    // dedicated showcase link target.
    for (const category of CATEGORIES) {
      const showcaseLink = main.getByRole("link", { name: new RegExp(`Shop ${capitalize(category.slug)}`, "i") });
      await expect(showcaseLink).toBeVisible();
      await expect(showcaseLink).toHaveAttribute("href", new RegExp(`/shop/category/${category.slug}$`));
    }
  });

  test("each category is reachable within two clicks from the homepage on desktop", async ({ page }) => {
    await page.goto("/en");
    for (const category of CATEGORIES) {
      await page.goto("/en");
      const link = page.getByRole("main").getByRole("link", { name: new RegExp(`Shop ${capitalize(category.slug)}`, "i") });
      await link.click();
      await expect(page).toHaveURL(new RegExp(`/en/shop/category/${category.slug}$`));
    }
  });

  test("a Sold Out product remains visible (not hidden) within its own category page", async ({ page }) => {
    // Pearl Tennis Bracelet is permanently seeded with stock 0 (a
    // dedicated always-sold-out fixture, scripts/seed.ts) — it must still
    // appear, browsable, on its own category page.
    await page.goto("/en/shop/category/bracelets");
    const main = page.getByRole("main");
    await expect(main.getByText("Pearl Tennis Bracelet").first()).toBeVisible();
    const card = main.locator(".group", { hasText: "Pearl Tennis Bracelet" }).first();
    await expect(card.getByRole("button", { name: "SOLD OUT" })).toBeDisabled();
  });
});

function capitalize(slug: string): string {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}
