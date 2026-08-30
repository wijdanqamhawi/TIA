import { test, expect } from "@playwright/test";

/**
 * Verifies the premium first-entry welcome screen: shown once per browser
 * session (never on a later navigation within the same session), correct
 * bilingual content/RTL, a "Shop Now" CTA that is the *only* way to leave
 * the screen — no auto-dismiss, no Escape, no background click — a
 * "WhatsApp" action that opens the store's configured link without closing
 * the screen, and that it never blocks the underlying page from being
 * present/rendered underneath.
 */

test.describe("welcome splash", () => {
  test("shows on first visit (EN), then never again this session", async ({ page }) => {
    await page.goto("/en");

    const dialog = page.getByRole("dialog", { name: "Welcome to ELORA JEWELLERY" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Timeless Elegance, Crafted for You.")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Shop Now" })).toBeVisible();

    // The page underneath is already there — the screen overlays it, it
    // doesn't block/delay the rest of the app from rendering.
    await expect(page.getByRole("link", { name: "ELORA JEWELLERY — Home" }).first()).toBeAttached();

    await dialog.getByRole("button", { name: "Shop Now" }).click();
    await expect(dialog).toBeHidden();

    // Same-session navigation: never reappears.
    await page.goto("/en/shop");
    await expect(page.getByRole("dialog", { name: "Welcome to ELORA JEWELLERY" })).toHaveCount(0);
    await page.goBack();
    await expect(page.getByRole("dialog", { name: "Welcome to ELORA JEWELLERY" })).toHaveCount(0);
  });

  test("never disappears on its own — no auto-dismiss, Escape and a background click do nothing — only Shop Now closes it", async ({
    page,
  }) => {
    await page.goto("/en");
    const dialog = page.getByRole("dialog", { name: "Welcome to ELORA JEWELLERY" });
    await expect(dialog).toBeVisible();

    // Wait well past the old (now-removed) 2.2s auto-dismiss window — the
    // screen must still be showing, since a customer should be able to
    // read it for as long as she wants before choosing an action.
    await page.waitForTimeout(4000);
    await expect(dialog).toBeVisible();

    // Escape triggers a native <dialog> `cancel` event by default — this
    // screen swallows it, so it must not close on Escape either.
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();

    // Clicking anywhere else in the screen (the burgundy backdrop outside
    // the card, the logo, the tagline) must not close it — "Shop Now" is
    // the only control that does.
    await page.mouse.click(4, 4);
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "Shop Now" }).click();
    await expect(dialog).toBeHidden();

    // After clicking Shop Now, the storefront underneath is fully normal —
    // routing/nav work exactly as on any other visit.
    await page.getByRole("link", { name: "Shop" }).first().click();
    await expect(page).toHaveURL(/\/en\/shop$/);
  });

  test("the WhatsApp action opens the store's configured link in a new tab and does not close the screen", async ({
    page,
    context,
  }) => {
    await page.goto("/en");
    const dialog = page.getByRole("dialog", { name: "Welcome to ELORA JEWELLERY" });
    const whatsapp = dialog.getByRole("link", { name: "WhatsApp" });
    await expect(whatsapp).toBeVisible();
    await expect(whatsapp).toHaveAttribute("target", "_blank");
    await expect(whatsapp).toHaveAttribute("href", /^https:\/\/wa\.me\/\d+/);

    const [popup] = await Promise.all([context.waitForEvent("page"), whatsapp.click()]);
    await popup.close();

    // Contacting the store via WhatsApp is not "entering" it — the welcome
    // screen must still be exactly as it was, in the original tab.
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Shop Now" })).toBeVisible();
  });

  test("shows correctly in Arabic/RTL with the exact required tagline and both CTAs", async ({ page }) => {
    await page.goto("/ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const dialog = page.getByRole("dialog", { name: "مرحبًا بكم في إيلورا للمجوهرات" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("أناقة خالدة، صُممت لأجلك.")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "تسوّق الآن" })).toBeVisible();
    await expect(dialog.getByRole("link", { name: "تواصل معنا عبر واتساب" })).toBeVisible();

    // Wait past the old auto-dismiss window here too — must still be there.
    await page.waitForTimeout(4000);
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "تسوّق الآن" }).click();
    await expect(dialog).toBeHidden();
  });

  test("a fresh session (new browser context) shows the screen again", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/en");
    await expect(page.getByRole("dialog", { name: "Welcome to ELORA JEWELLERY" })).toBeVisible();
    await context.close();
  });

  test("does not block cart/checkout-critical elements from being present underneath", async ({ page }) => {
    await page.goto("/en/shop");
    // The shop grid must already exist in the DOM even while the welcome
    // screen is the visible top-layer element — proving it never delays
    // data fetching/rendering of the actual page.
    await expect(page.locator('[data-testid="product-grid"]')).toBeAttached();
  });

  test("never appears on an admin route", async ({ page }) => {
    await page.goto("/admin");
    // `/admin` redirects an unauthenticated visitor to /login — either way,
    // `/admin/*` uses its own separate root layout that never mounts
    // WelcomeSplash at all.
    await expect(page.getByRole("dialog", { name: "Welcome to ELORA JEWELLERY" })).toHaveCount(0);
  });
});
