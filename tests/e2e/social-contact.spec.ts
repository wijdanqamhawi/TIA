import { test, expect, type Page } from "./fixtures/base";
import { addCardToCart } from "./fixtures/add-to-cart";

/**
 * T212 (quickstart Scenario 11): footer/Contact-page/floating Instagram +
 * WhatsApp resolve to the configured destination with safe `rel`
 * attributes, never overlap primary actions, are keyboard-accessible,
 * fail safely when unconfigured, and use the correct localized greeting
 * per locale. The header and the phone/tablet menu deliberately carry no
 * social links (the header's announcement bar carries only the delivery
 * location and EN | AR controls, from `lg` up).
 *
 * All placements resolve their href server-side from the single
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
  // Counting links in a footer that has not rendered yet would read zero
  // and silently skip the caller, so wait for the footer itself first.
  await expect(footer.getByRole("heading", { name: "Shop" })).toBeVisible();
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

/** The open hamburger-menu drawer (portalled to <body>, marked by `data-nav-drawer-open`). */
function menuDrawer(page: Page) {
  return page.locator("[data-nav-drawer-open]");
}

test.describe("social contact — navbar", () => {
  test("desktop header carries the main nav, logo and Search/Wishlist/Account/Cart, with location + EN | AR on the announcement bar — no social links", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/en");
    const header = page.getByRole("banner");

    await expect(header.getByRole("link", { name: "TIA — Home" })).toBeVisible();
    await expect(header.getByRole("navigation").getByRole("link", { name: "Shop", exact: true })).toBeVisible();
    for (const name of ["Search", "Wishlist", "Account", "Cart"]) {
      await expect(header.getByRole("link", { name, exact: true })).toBeVisible();
    }

    // The approved reference puts the delivery-location trigger and the
    // EN | AR switch on the announcement bar above the header, from `lg`
    // up (`AnnouncementBar.tsx`) — exactly one of each.
    await expect(header.getByRole("button", { name: "Select delivery location" })).toHaveCount(1);
    await expect(header.getByRole("button", { name: "Select delivery location" })).toBeVisible();
    await expect(header.getByRole("button", { name: "EN", exact: true })).toBeVisible();
    await expect(header.getByRole("button", { name: "AR", exact: true })).toBeVisible();

    // Social links live in the footer / Contact page / floating button only.
    await expect(header.locator('a[href*="instagram.com"], a[href*="wa.me"]')).toHaveCount(0);
  });

  test("phone/tablet menu carries only Collections, About and Contact — no social, location or language controls", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE);
    await page.goto("/en");
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("button", { name: "Close menu" }).last()).toBeVisible();

    const drawer = menuDrawer(page);
    await expect(drawer.getByText("Collections", { exact: true })).toBeVisible();
    await expect(drawer.getByRole("link", { name: "Bracelets", exact: true })).toBeVisible();
    await expect(drawer.getByRole("link", { name: "About", exact: true })).toBeVisible();
    await expect(drawer.getByRole("link", { name: "Contact", exact: true })).toBeVisible();

    await expect(drawer.locator('a[href*="instagram.com"], a[href*="wa.me"]')).toHaveCount(0);
    await expect(drawer.getByRole("button", { name: /^(EN|AR)$/ })).toHaveCount(0);
    await expect(drawer.getByRole("button", { name: /Select delivery location/ })).toHaveCount(0);
  });
});

test.describe("social contact — footer", () => {
  test("footer Instagram/WhatsApp links are safe, labeled, and share the Contact page's and floating button's configured destination", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    const configured = await socialIsConfigured(page);

    const footer = page.getByRole("contentinfo");
    const footerInstagram = footer.locator('a[href*="instagram.com"]').first();
    const footerWhatsapp = footer.locator('a[href*="wa.me"]').first();
    const footerHrefs = {
      instagram: configured.instagram ? await footerInstagram.getAttribute("href") : null,
      whatsapp: configured.whatsapp ? await footerWhatsapp.getAttribute("href") : null,
    };

    if (configured.instagram) {
      await expectSafeExternalLink(footerInstagram);
      // Never an unlabeled icon-only control (spec: understandable even
      // when represented primarily by icons).
      expect(await footerInstagram.getAttribute("aria-label")).toBeTruthy();
    }
    if (configured.whatsapp) {
      await expectSafeExternalLink(footerWhatsapp);
      expect(await footerWhatsapp.getAttribute("aria-label")).toBeTruthy();
      expect(footerHrefs.whatsapp).toMatch(/^https:\/\/wa\.me\/\d+/);
    }

    // One centralized config — the footer, the Contact page and the
    // floating button can never diverge.
    await page.goto("/en/contact");
    if (configured.instagram) {
      const contactHref = await page.getByRole("link", { name: /Message us on Instagram/ }).getAttribute("href");
      expect(footerHrefs.instagram).toBe(contactHref);
    }
    if (configured.whatsapp) {
      const contactHref = await page.getByRole("link", { name: /Chat with us on WhatsApp/ }).getAttribute("href");
      expect(footerHrefs.whatsapp).toBe(contactHref);
      expect(footerHrefs.whatsapp).toBe(await page.getByTestId("floating-whatsapp").getAttribute("href"));
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
    // Reaching checkout requires a non-empty cart. The Golden Bangle
    // Bracelet card specifically: a no-options product adds directly from
    // its card (the with-options Aurelia cuff in the same grid opens Quick
    // View instead).
    await page.goto("/en/shop/category/bracelets");
    await addCardToCart(page, "Golden Bangle Bracelet");

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
      await expect(page.getByRole("dialog", { name: "Install TIA" })).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15000 });

    const banner = page.getByRole("dialog", { name: "Install TIA" });
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
    const enHref = await page.getByRole("contentinfo").locator('a[href*="wa.me"]').first().getAttribute("href");

    await page.goto("/ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const arHref = await page.getByRole("contentinfo").locator('a[href*="wa.me"]').first().getAttribute("href");

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
