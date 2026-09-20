import { test, expect } from "./fixtures/base";
import { productCard } from "./fixtures/product-card";

/**
 * T237 (quickstart Scenario 1b / 12): category isolation — 0% cross-
 * category leakage. Reads only, using the seeded catalog
 * (scripts/seed.ts): golden-bangle-bracelet / aurelia-signature-cuff →
 * bracelets; solitaire-ring / pearl-tennis-bracelet ("Pearl & Turquoise
 * Ring Set", renamed in place and moved to Rings) → rings;
 * pearl-drop-earrings → earrings; classic-gold-watch ("Classic Watch") →
 * watches.
 */
const CATEGORIES = [
  {
    slug: "bracelets",
    name: "Bracelets",
    own: ["Golden Bangle Bracelet", "Aurelia Signature Cuff"],
    foreign: ["Solitaire Ring", "Pearl & Turquoise Ring Set", "Pearl Drop Earrings", "Classic Watch"],
  },
  {
    slug: "rings",
    name: "Rings",
    own: ["Solitaire Ring", "Pearl & Turquoise Ring Set"],
    foreign: ["Golden Bangle Bracelet", "Aurelia Signature Cuff", "Pearl Drop Earrings", "Classic Watch"],
  },
  {
    slug: "earrings",
    name: "Earrings",
    own: ["Pearl Drop Earrings"],
    foreign: ["Golden Bangle Bracelet", "Aurelia Signature Cuff", "Solitaire Ring", "Pearl & Turquoise Ring Set", "Classic Watch"],
  },
  {
    slug: "watches",
    name: "Watches",
    own: ["Classic Watch"],
    foreign: ["Golden Bangle Bracelet", "Aurelia Signature Cuff", "Solitaire Ring", "Pearl & Turquoise Ring Set", "Pearl Drop Earrings"],
  },
] as const;

test.describe("category isolation — 0% cross-category leakage", () => {
  for (const category of CATEGORIES) {
    test(`${category.slug} category page shows only its own products`, async ({ page }) => {
      await page.goto(`/en/shop/category/${category.slug}`);
      const main = page.getByRole("main");

      for (const name of category.own) {
        await expect(main.getByRole("link", { name, exact: true })).toBeVisible();
      }
      for (const name of category.foreign) {
        await expect(main.getByText(name)).toHaveCount(0);
      }
    });
  }

  // The approved homepage has no per-category Featured strips any more; its
  // category entry points are the "Shop by Category" tiles, each of which
  // must lead to its own category and nowhere else.
  test("homepage Shop by Category tiles each link to their own category only", async ({ page }) => {
    await page.goto("/en");
    const main = page.getByRole("main");

    await expect(main.getByRole("heading", { name: "Shop by Category", level: 2 })).toBeVisible();
    for (const category of CATEGORIES) {
      const tile = main.getByRole("link", { name: category.name, exact: true });
      await expect(tile).toBeVisible();
      await expect(tile).toHaveAttribute("href", new RegExp(`/shop/category/${category.slug}$`));
    }
  });

  test("each category is reachable within two clicks from the homepage on desktop", async ({ page }) => {
    for (const category of CATEGORIES) {
      await page.goto("/en");
      await page.getByRole("main").getByRole("link", { name: category.name, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/en/shop/category/${category.slug}$`));
      await expect(page.getByRole("heading", { name: category.name, level: 1 })).toBeVisible();
    }
  });

  test("a Sold Out product remains visible (not hidden) within its own category page", async ({ page }) => {
    // Pearl & Turquoise Ring Set is permanently seeded with stock 0 (a
    // dedicated always-sold-out fixture, scripts/seed.ts) — it must still
    // appear, browsable, on its own category page.
    await page.goto("/en/shop/category/rings");
    const card = productCard(page.getByRole("main"), "Pearl & Turquoise Ring Set");
    await expect(card).toBeVisible();
    await expect(card.getByRole("button", { name: "SOLD OUT" })).toBeDisabled();
  });
});
