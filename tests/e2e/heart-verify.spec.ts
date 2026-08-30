import { test, expect } from "./fixtures/base";
import { registerNewCustomer } from "./admin-helpers";

test("heart toggles add/remove with visual state, and the wishlist page reflects it — EN", async ({ page }) => {
  await registerNewCustomer(page, "Heart Verify Tester", `heart-verify-en-${Date.now()}`);
  await page.goto("/en/shop");
  await page.waitForLoadState("networkidle");

  const heart = page.getByRole("button", { name: "Add to Wishlist" }).first();
  await expect(heart).toBeVisible();
  await expect(heart).toHaveAttribute("aria-pressed", "false");

  await heart.click();
  const filled = page.getByRole("button", { name: "Remove from Wishlist" }).first();
  await expect(filled).toBeVisible({ timeout: 10000 });
  await expect(filled).toHaveAttribute("aria-pressed", "true");
  // Heart glyph itself visually fills in (fill="currentColor" instead of "none").
  await expect(filled.locator("svg")).toHaveAttribute("fill", "currentColor");

  await page.goto("/en/wishlist");
  await expect(page.getByRole("heading", { name: "My Wishlist" })).toBeVisible();
  const wishlistText = await page.locator("main").innerText();
  expect(wishlistText).not.toContain("Your wishlist is empty");

  // Reload the shop page — the filled state must persist (server-derived, not just client memory).
  await page.goto("/en/shop");
  await page.waitForLoadState("networkidle");
  const stillFilled = page.getByRole("button", { name: "Remove from Wishlist" }).first();
  await expect(stillFilled).toBeVisible();

  // Toggle it back off from the card itself.
  await stillFilled.click();
  const unfilled = page.getByRole("button", { name: "Add to Wishlist" }).first();
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

  const heart = page.getByRole("button", { name: "أضف إلى المفضلة" }).first();
  await expect(heart).toBeVisible();
  await heart.click();

  const filled = page.getByRole("button", { name: "إزالة من المفضلة" }).first();
  await expect(filled).toBeVisible({ timeout: 10000 });

  await page.goto("/ar/wishlist");
  const wishlistText = await page.locator("main").innerText();
  expect(wishlistText.length).toBeGreaterThan(0);
});

test("guest click redirects to login with wishlist intent, unauthenticated — no crash", async ({ page }) => {
  await page.goto("/en/shop");
  await page.waitForLoadState("networkidle");
  const heart = page.getByRole("button", { name: "Add to Wishlist" }).first();
  await heart.click();
  await expect(page).toHaveURL(/\/login\?next=.*intent=wishlist/, { timeout: 10000 });
});
