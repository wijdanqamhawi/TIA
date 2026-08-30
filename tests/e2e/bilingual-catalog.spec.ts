import { test, expect } from "./fixtures/base";

/**
 * T245 (quickstart Scenario 13 steps 4-5, spec FR-074): bilingual
 * product/category content. Seeded "Pearl Tennis Bracelet"
 * (scripts/seed.ts) has `ar: null` for `name`/`description`/`material` —
 * on the Arabic locale it must fall back to the raw English text
 * (`resolveLocalizedString`, src/types/localizedString.ts), never a
 * blank/undefined/"null" string. The four category names must render
 * correctly in Arabic wherever a category name is shown.
 */
test.describe("bilingual catalog content", () => {
  test("a product with no Arabic translation falls back to English text on the Arabic product page", async ({
    page,
  }) => {
    await page.goto("/ar/shop/pearl-tennis-bracelet");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    // Falls back to the real English name/material — never blank, never
    // the literal string "null"/"undefined".
    await expect(page.getByRole("heading", { name: "Pearl Tennis Bracelet", level: 1 })).toBeVisible();
    await expect(page.getByText("Freshwater Pearl & Sterling Silver")).toBeVisible();
    await expect(page.getByText("Delicate freshwater pearls set in a classic tennis-bracelet chain.")).toBeVisible();

    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("null");
    expect(bodyText).not.toContain("undefined");
  });

  test("a product with no Arabic translation still shows its real English name in Arabic category/search listings", async ({
    page,
  }) => {
    await page.goto("/ar/shop/category/bracelets");
    await expect(page.getByRole("main").getByText("Pearl Tennis Bracelet").first()).toBeVisible();
  });

  test("all four category names display correctly in Arabic", async ({ page }) => {
    await page.goto("/ar/shop");
    await expect(page.getByRole("main").getByRole("link", { name: "أساور", exact: true })).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: "خواتم", exact: true })).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: "أقراط", exact: true })).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: "ساعات", exact: true })).toBeVisible();
  });

  test("all four category names display correctly in Arabic on the homepage showcases", async ({ page }) => {
    await page.goto("/ar");
    await expect(page.getByRole("main").getByRole("link", { name: "أساور", exact: true })).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: "خواتم", exact: true })).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: "أقراط", exact: true })).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: "ساعات", exact: true })).toBeVisible();
  });
});
