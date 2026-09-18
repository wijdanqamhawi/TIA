import { test, expect } from "@playwright/test";

/**
 * Verifies TIA's first-entry screen: part of the very first paint, shown
 * once per browser session (never on a later navigation within the same
 * session), correct bilingual content/RTL, an ENTER THE COLLECTION CTA
 * that is the *only* way to leave the screen — no auto-dismiss, no Escape,
 * no background click — an EN | AR switch that re-localizes the screen
 * without closing it, reduced-motion support, and that it never blocks the
 * underlying page from being present/rendered underneath.
 */

test.describe("welcome splash", () => {
  test("is part of the server-rendered first paint (before hydration)", async ({ request }) => {
    const html = await (await request.get("/en")).text();
    expect(html).toContain("data-welcome-splash");
    expect(html).toContain("Enter the Collection");
  });

  test("shows on first visit (EN), then never again this session", async ({ page }) => {
    await page.goto("/en");

    const dialog = page.getByRole("dialog", { name: "Welcome to TIA" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Accessories & More")).toBeVisible();
    const enter = dialog.getByRole("button", { name: "Enter the Collection" });
    await expect(enter).toBeVisible();

    // The page underneath is already there — the screen overlays it, it
    // doesn't block/delay the rest of the app from rendering.
    await expect(page.getByRole("link", { name: "TIA — Home" }).first()).toBeAttached();

    await enter.click();
    await expect(dialog).toBeHidden();

    // Same-session navigation: never reappears.
    await page.goto("/en/shop");
    await expect(page.getByRole("dialog", { name: "Welcome to TIA" })).toHaveCount(0);
    await page.goBack();
    await expect(page.getByRole("dialog", { name: "Welcome to TIA" })).toHaveCount(0);
  });

  test("never disappears on its own — no auto-dismiss, Escape and a background click do nothing — only Enter the Collection closes it", async ({
    page,
  }) => {
    await page.goto("/en");
    const dialog = page.getByRole("dialog", { name: "Welcome to TIA" });
    const enter = dialog.getByRole("button", { name: "Enter the Collection" });
    await expect(enter).toBeEnabled();

    // Well past any plausible auto-dismiss window — the screen must still
    // be showing, since a customer should be able to stay as long as she
    // wants before choosing to enter.
    await page.waitForTimeout(4000);
    await expect(dialog).toBeVisible();

    // Escape triggers a native <dialog> `cancel` event by default — this
    // screen swallows it, so it must not close on Escape either.
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();

    // Clicking anywhere else on the screen must not close it.
    await page.mouse.click(4, 4);
    await expect(dialog).toBeVisible();

    await enter.click();
    await expect(dialog).toBeHidden();

    // After entering, the storefront underneath is fully normal —
    // routing/nav work exactly as on any other visit.
    await page.getByRole("link", { name: "Shop" }).first().click();
    await expect(page).toHaveURL(/\/en\/shop$/);
  });

  test("moves keyboard focus onto Enter the Collection when it opens", async ({ page }) => {
    await page.goto("/en");
    const enter = page.getByRole("dialog", { name: "Welcome to TIA" }).getByRole("button", { name: "Enter the Collection" });
    await expect(enter).toBeEnabled();
    await expect(enter).toBeFocused();
  });

  test("the EN | AR switch re-localizes the screen to Arabic/RTL without closing it", async ({ page }) => {
    await page.goto("/en");
    const dialog = page.getByRole("dialog", { name: "Welcome to TIA" });
    await expect(dialog.getByRole("button", { name: "Enter the Collection" })).toBeEnabled();

    await dialog.getByRole("button", { name: "AR", exact: true }).click();

    await expect(page).toHaveURL(/\/ar$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    // Choosing a language is not entering — the screen is still there.
    const arabicDialog = page.getByRole("dialog", { name: "مرحبًا بكِ في تيا" });
    await expect(arabicDialog).toBeVisible();
    await expect(arabicDialog.getByRole("button", { name: "ادخلي إلى المجموعة" })).toBeVisible();
  });

  test("shows correctly in Arabic/RTL with the exact required copy and the language switch", async ({ page }) => {
    await page.goto("/ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const dialog = page.getByRole("dialog", { name: "مرحبًا بكِ في تيا" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("إكسسوارات وأكثر")).toBeVisible();
    await expect(dialog.getByText("أكثر من مجرد إكسسوارات.")).toBeVisible();
    const enter = dialog.getByRole("button", { name: "ادخلي إلى المجموعة" });
    await expect(enter).toBeVisible();
    await expect(dialog.getByRole("button", { name: "EN", exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "AR", exact: true })).toBeVisible();

    // Must still be there after a wait here too.
    await page.waitForTimeout(4000);
    await expect(dialog).toBeVisible();

    await enter.click();
    await expect(dialog).toBeHidden();
  });

  test("respects prefers-reduced-motion — shown without animation and closed without a fade", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/en");
    const dialog = page.getByRole("dialog", { name: "Welcome to TIA" });
    const enter = dialog.getByRole("button", { name: "Enter the Collection" });
    await expect(enter).toBeEnabled();

    // No entrance animation is running on the CTA.
    expect(await enter.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");

    await enter.click();
    await expect(dialog).toBeHidden({ timeout: 500 });
    await context.close();
  });

  test("a fresh session (new browser context) shows the screen again", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/en");
    await expect(page.getByRole("dialog", { name: "Welcome to TIA" })).toBeVisible();
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
    await expect(page.getByRole("dialog", { name: "Welcome to TIA" })).toHaveCount(0);
  });
});
