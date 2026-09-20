import { test, expect } from "./fixtures/base";
import { registerNewCustomer } from "./admin-helpers";
import { productCard } from "./fixtures/product-card";

// The card heart toggles the wishlist directly only for a no-options product
// (a with-options product's heart opens its detail page instead — see
// `ProductCard`), so every test here uses the seeded Golden Bangle Bracelet
// card rather than whichever card happens to come first in the grid.
const PRODUCT_EN = "Golden Bangle Bracelet";
const PRODUCT_AR = "سوار ذهبي";

test("heart toggles add/remove with visual state, and the wishlist page reflects it — EN", async ({ page }) => {
  await registerNewCustomer(page, "Heart Verify Tester", `heart-verify-en-${Date.now()}`);
  await page.goto("/en/shop");
  await page.waitForLoadState("networkidle");

  const card = productCard(page.getByRole("main"), PRODUCT_EN);
  const heart = card.getByRole("button", { name: "Add to Wishlist" });
  await expect(heart).toBeVisible();
  await expect(heart).toHaveAttribute("aria-pressed", "false");

  await heart.click();
  const filled = card.getByRole("button", { name: "Remove from Wishlist" });
  await expect(filled).toBeVisible({ timeout: 10000 });
  await expect(filled).toHaveAttribute("aria-pressed", "true");
  // Heart glyph itself visually fills in (fill="currentColor" instead of "none").
  await expect(filled.locator("svg")).toHaveAttribute("fill", "currentColor");

  await page.goto("/en/wishlist");
  await expect(page.getByRole("heading", { name: "My Wishlist" })).toBeVisible();
  await expect(page.locator("main")).toContainText(PRODUCT_EN);
  await expect(page.locator("main")).not.toContainText("Your wishlist is empty");

  // Reload the shop page — the filled state must persist (server-derived, not just client memory).
  await page.goto("/en/shop");
  await page.waitForLoadState("networkidle");
  const stillFilled = card.getByRole("button", { name: "Remove from Wishlist" });
  await expect(stillFilled).toBeVisible();

  // Toggle it back off from the card itself.
  await stillFilled.click();
  const unfilled = card.getByRole("button", { name: "Add to Wishlist" });
  await expect(unfilled).toBeVisible({ timeout: 10000 });
  await expect(unfilled).toHaveAttribute("aria-pressed", "false");

  await page.goto("/en/wishlist");
  await expect(page.locator("main")).toContainText("Your wishlist is empty");
});

test("heart shows filled state and works — AR/RTL", async ({ page }) => {
  await registerNewCustomer(page, "Heart Verify Tester AR", `heart-verify-ar-${Date.now()}`);
  await page.goto("/ar/shop");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

  const card = productCard(page.getByRole("main"), PRODUCT_AR);
  const heart = card.getByRole("button", { name: "أضف إلى المفضلة" });
  await expect(heart).toBeVisible();
  await heart.click();

  const filled = card.getByRole("button", { name: "إزالة من المفضلة" });
  await expect(filled).toBeVisible({ timeout: 10000 });
  await expect(filled).toHaveAttribute("aria-pressed", "true");

  await page.goto("/ar/wishlist");
  await expect(page.locator("main")).toContainText(PRODUCT_AR);
});

test("guest click redirects to login with wishlist intent, unauthenticated — no crash", async ({ page }) => {
  await page.goto("/en/shop");
  await page.waitForLoadState("networkidle");
  const heart = productCard(page.getByRole("main"), PRODUCT_EN).getByRole("button", { name: "Add to Wishlist" });
  await heart.click();
  await expect(page).toHaveURL(/\/login\?next=.*intent=wishlist/, { timeout: 10000 });
});
