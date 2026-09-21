import { test, expect } from "./fixtures/base";
import { startFreshSession, switchToArabicWithAvailableControl } from "./fixtures/language";

/**
 * T244 (quickstart Scenario 13 steps 1-3, 13): the language switcher
 * updates `dir`/fully relocalizes the page (checked via several distinct
 * translated strings, not just one heading), the chosen language persists
 * across navigation and a full page refresh (the `NEXT_LOCALE` cookie set
 * by the routing middleware, T026), and an unsupported browser locale
 * falls back to English (next-intl's own `localeDetection` default:
 * `NEXT_LOCALE` cookie → `Accept-Language` → `defaultLocale`, per
 * src/middleware.ts's own documented order).
 */
test.describe("language switching", () => {
  test("the viewport's available language control relocalizes the whole page and updates dir", async ({ page }) => {
    // Neither the header nor the phone/tablet menu has a language
    // switcher — the welcome screen's EN | AR is the control at every
    // viewport, and the helper drives exactly that.
    await page.goto("/en");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    // The approved homepage's two merchandising headings (it has no Best
    // Sellers section any more — see `(storefront)/page.tsx`).
    await expect(page.getByRole("heading", { name: "New Arrivals" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Shop by Category" })).toBeVisible();

    await switchToArabicWithAvailableControl(page);

    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.getByRole("heading", { name: "وصل حديثًا" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "تسوقي حسب الفئة" })).toBeVisible();
  });

  test("on a phone the menu has no language switcher; the welcome screen's EN | AR relocalizes the page", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en");

    await page.getByRole("button", { name: "Open menu" }).click();
    const drawer = page.locator("[data-nav-drawer-open]");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("button", { name: /^(EN|AR)$/ })).toHaveCount(0);
    await drawer.getByRole("button", { name: "Close menu" }).last().click();
    await expect(drawer).toBeHidden();

    // This test is specifically about the welcome screen's EN | AR being
    // the phone's only language control, so put the session back to a
    // first-visit state and assert the screen really is there before the
    // helper uses it — rather than letting the helper decide.
    await startFreshSession(page);
    await switchToArabicWithAvailableControl(page);

    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "وصل حديثًا" })).toBeVisible();
  });

  test("the chosen language persists across navigation and a full page refresh", async ({ page }) => {
    await page.goto("/en");
    await switchToArabicWithAvailableControl(page);
    await expect(page).toHaveURL(/\/ar$/);

    // Navigate to a different page — still Arabic, no re-prompt needed.
    await page.getByRole("link", { name: "المتجر", exact: true }).first().click();
    await expect(page).toHaveURL(/\/ar\/shop$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    // A full page refresh (simulates reopening the app) keeps the cookie-
    // persisted locale rather than reverting to English.
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page).toHaveURL(/\/ar\/shop$/);
  });

  test("an unsupported browser locale falls back to English", async ({ browser }) => {
    const context = await browser.newContext({ locale: "fr-FR", extraHTTPHeaders: { "Accept-Language": "fr-FR,fr;q=0.9" } });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page).toHaveURL(/\/en(\/|$)/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await context.close();
  });
});
