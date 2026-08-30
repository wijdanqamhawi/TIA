import { test, expect, type Page } from "./fixtures/base";

/**
 * T212 (quickstart Scenario 11): navbar/footer/floating Instagram +
 * WhatsApp resolve to the configured destination with safe `rel`
 * attributes, never overlap primary actions, are keyboard-accessible,
 * fail safely when unconfigured, and use the correct localized greeting
 * per locale.
 *
 * All three placements resolve their href server-side from the single
 * centralized config (`lib/config/social.ts`), so these assertions run
 * against whatever `NEXT_PUBLIC_INSTAGRAM_URL` /
 * `NEXT_PUBLIC_WHATSAPP_PHONE` the server was started with. The suite
 * therefore asserts the *invariant* in both directions: when a link is
 * configured it must be correct and safe; when it isn't, it must be
 * absent entirely rather than rendered dead (T208). A dedicated
 * "fail-safe" test covers the unconfigured branch explicitly.
 */

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

/** Whether this server instance has WhatsApp/Instagram configured at all. */
async function socialIsConfigured(page: Page): Promise<{ instagram: boolean; whatsapp: boolean }> {
  await page.goto("/en");
  const footer = page.getByRole("contentinfo");
  return {
    instagram: (await footer.locator('a[href*="instagram.com"]').count()) > 0,
    whatsapp: (await footer.locator('a[href*="wa.me"]').count()) > 0,
  };
}

async function expectSafeExternalLink(locator: ReturnType<Page["locator"]>) {
  await expect(locator).toHaveAttribute("target", "_blank");
  const rel = (await locator.getAttribute("rel")) ?? "";
  expect(rel).toContain("noopener");
  expect(rel).toContain("noreferrer");
}

test.describe("social contact — navbar", () => {
  test("desktop navbar Instagram/WhatsApp links are safe, labeled, and point at the configured destination", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    const configured = await socialIsConfigured(page);

    const header = page.getByRole("banner");

    if (configured.instagram) {
      const instagram = header.locator('a[href*="instagram.com"]').first();
      await expect(instagram).toBeVisible();
      await expectSafeExternalLink(instagram);
      // Never an unlabeled icon-only control (spec: understandable even
      // when represented primarily by icons).
      expect(await instagram.getAttribute("aria-label")).toBeTruthy();
    }

    if (configured.whatsapp) {
      const whatsapp = header.locator('a[href*="wa.me"]').first();
      await expect(whatsapp).toBeVisible();
      await expectSafeExternalLink(whatsapp);
      expect(await whatsapp.getAttribute("aria-label")).toBeTruthy();
      expect(await whatsapp.getAttribute("href")).toMatch(/^https:\/\/wa\.me\/\d+/);
    }
  });

  test("mobile hamburger menu exposes the same Instagram/WhatsApp destinations", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    const configured = await socialIsConfigured(page);

    await page.goto("/en");
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("button", { name: "Close menu" }).last()).toBeVisible();

    const drawer = page.locator("div.relative.ms-auto");

    if (configured.instagram) {
      const instagram = drawer.locator('a[href*="instagram.com"]').first();
      await expect(instagram).toBeVisible();
      await expectSafeExternalLink(instagram);
    }
    if (configured.whatsapp) {
      const whatsapp = drawer.locator('a[href*="wa.me"]').first();
      await expect(whatsapp).toBeVisible();
      await expectSafeExternalLink(whatsapp);
    }
  });
});

test.describe("social contact — footer", () => {
  test("footer Instagram/WhatsApp links are safe and share the navbar's configured destination", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    const configured = await socialIsConfigured(page);

    const header = page.getByRole("banner");
    const footer = page.getByRole("contentinfo");

    if (configured.instagram) {
      const footerHref = await footer.locator('a[href*="instagram.com"]').first().getAttribute("href");
      const headerHref = await header.locator('a[href*="instagram.com"]').first().getAttribute("href");
      // One centralized config — the two placements can never diverge.
      expect(footerHref).toBe(headerHref);
      await expectSafeExternalLink(footer.locator('a[href*="instagram.com"]').first());
    }

    if (configured.whatsapp) {
      const footerHref = await footer.locator('a[href*="wa.me"]').first().getAttribute("href");
      const headerHref = await header.locator('a[href*="wa.me"]').first().getAttribute("href");
      expect(footerHref).toBe(headerHref);
      await expectSafeExternalLink(footer.locator('a[href*="wa.me"]').first());
    }
  });
});

test.describe("social contact — floating WhatsApp button", () => {
  test("is visible on the storefront, safe, keyboard-focusable, and touch-sized", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    const configured = await socialIsConfigured(page);
    test.skip(!configured.whatsapp, "WhatsApp is unconfigured on this server instance.");

    await page.goto("/en");
    const floating = page.getByTestId("floating-whatsapp");
    await expect(floating).toBeVisible();
    await expectSafeExternalLink(floating);

    // Touch-target minimum (research.md §18a).
    const box = await floating.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);

    // Keyboard-accessible: it's a real anchor, so it can take focus.
    await floating.focus();
    await expect(floating).toBeFocused();
  });

  test("is hidden during checkout so it can never cover the form's primary actions", async ({ page }) => {
    const configured = await socialIsConfigured(page);
    test.skip(!configured.whatsapp, "WhatsApp is unconfigured on this server instance.");

    await page.setViewportSize(MOBILE);
    // Reaching checkout requires a non-empty cart.
    await page.goto("/en/shop/category/bracelets");
    await expect(async () => {
      await page.getByRole("main").getByRole("button", { name: "Add to Cart" }).first().click();
      await expect(page.getByRole("main").getByRole("button", { name: "Add to Cart" }).first()).toBeEnabled({
        timeout: 2000,
      });
    }).toPass({ timeout: 20000 });

    await page.goto("/en/checkout");
    await expect(page.getByLabel("Full Name")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("floating-whatsapp")).toHaveCount(0);
  });

  test("never overlaps the PWA install banner — it shifts above whatever is reserved", async ({ page }) => {
    const configured = await socialIsConfigured(page);
    test.skip(!configured.whatsapp, "WhatsApp is unconfigured on this server instance.");

    await page.setViewportSize(MOBILE);
    await page.addInitScript(() => {
      window.localStorage.removeItem("elora-install-dismissed-at");
    });
    await page.goto("/en");

    const floating = page.getByTestId("floating-whatsapp");
    await expect(floating).toBeVisible();
    const before = await floating.boundingBox();

    // Surface the install banner, which reserves the bottom band.
    await expect(async () => {
      await page.evaluate(() => {
        const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
          prompt?: () => Promise<void>;
          userChoice?: Promise<{ outcome: string }>;
        };
        event.prompt = async () => {};
        event.userChoice = Promise.resolve({ outcome: "dismissed" });
        window.dispatchEvent(event);
      });
      await expect(page.getByRole("dialog", { name: "Install ELORA JEWELLERY" })).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15000 });

    const banner = page.getByRole("dialog", { name: "Install ELORA JEWELLERY" });
    const bannerBox = await banner.boundingBox();
    const after = await floating.boundingBox();

    // It moved up out of the banner's band...
    expect(after!.y).toBeLessThan(before!.y);
    // ...and the two no longer intersect vertically.
    expect(after!.y + after!.height).toBeLessThanOrEqual(bannerBox!.y + 1);
  });
});

test.describe("social contact — localization", () => {
  test("the WhatsApp greeting matches the active locale", async ({ page }) => {
    const configured = await socialIsConfigured(page);
    test.skip(!configured.whatsapp, "WhatsApp is unconfigured on this server instance.");

    await page.setViewportSize(DESKTOP);

    await page.goto("/en");
    const enHref = await page.getByRole("banner").locator('a[href*="wa.me"]').first().getAttribute("href");

    await page.goto("/ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const arHref = await page.getByRole("banner").locator('a[href*="wa.me"]').first().getAttribute("href");

    // Same number, different pre-filled greeting per locale (research.md §37).
    expect(enHref).toMatch(/^https:\/\/wa\.me\/\d+/);
    expect(arHref).toMatch(/^https:\/\/wa\.me\/\d+/);
    expect(enHref!.split("?")[0]).toBe(arHref!.split("?")[0]);

    const arText = decodeURIComponent(new URL(arHref!).searchParams.get("text") ?? "");
    // The Arabic greeting must actually contain Arabic script, proving the
    // localized value was selected rather than the English fallback.
    expect(arText).toMatch(/[؀-ۿ]/);
    expect(arHref).not.toBe(enHref);
  });

  test("the floating button anchors to the correct corner in RTL", async ({ page }) => {
    const configured = await socialIsConfigured(page);
    test.skip(!configured.whatsapp, "WhatsApp is unconfigured on this server instance.");

    await page.setViewportSize(MOBILE);

    await page.goto("/en");
    const ltrBox = await page.getByTestId("floating-whatsapp").boundingBox();
    // LTR: `end` resolves to the right edge.
    expect(ltrBox!.x).toBeGreaterThan(MOBILE.width / 2);

    await page.goto("/ar");
    const rtlBox = await page.getByTestId("floating-whatsapp").boundingBox();
    // RTL: the same logical `end-4` mirrors to the left edge.
    expect(rtlBox!.x).toBeLessThan(MOBILE.width / 2);
  });
});

test.describe("social contact — fail-safe when unconfigured", () => {
  test("no dead, empty, or placeholder social link is ever rendered", async ({ page }) => {
    await page.goto("/en");

    // Whatever the configuration, there must never be an anchor that
    // looks like a social link but goes nowhere (T208).
    const suspicious = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll("a"));
      return anchors
        .filter((a) => {
          const href = a.getAttribute("href");
          const label = (a.getAttribute("aria-label") ?? "") + a.textContent;
          const looksSocial = /instagram|whatsapp/i.test(label);
          return looksSocial && (!href || href === "#" || href.trim() === "");
        })
        .map((a) => a.outerHTML);
    });
    expect(suspicious).toEqual([]);

    // And the floating button is either a real link or absent — never a
    // rendered-but-inert placeholder.
    const floatingCount = await page.getByTestId("floating-whatsapp").count();
    if (floatingCount > 0) {
      const href = await page.getByTestId("floating-whatsapp").getAttribute("href");
      expect(href).toMatch(/^https:\/\/wa\.me\/\d+/);
    }
  });
});
