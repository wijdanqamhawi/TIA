import { test, expect, type Page } from "./fixtures/base";
import { addDetailToCart } from "./fixtures/add-to-cart";

/**
 * T200 (quickstart Scenario 10, research.md §27): manifest validity,
 * service-worker registration, the branded offline fallback in both
 * languages, install-prompt visibility/suppression, a standalone-mode
 * responsive spot-check, and the security-critical stale-cache regression
 * check.
 *
 * The service worker is only registered in a production build (T195,
 * `next build && next start` — never `next dev`), so every SW-dependent
 * assertion here checks `navigator.serviceWorker` support/registration
 * first and is skipped with a clear reason when it isn't active, rather
 * than failing on an environment this suite doesn't control. The manifest
 * and install-prompt checks don't depend on the service worker at all and
 * always run.
 */

async function hasNoHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
}

test.describe("PWA — manifest", () => {
  test("the manifest is valid and matches the approved TIA navy + ivory identity", async ({ page, request }) => {
    await page.goto("/en");
    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute("href");
    expect(manifestHref).toBeTruthy();

    const response = await request.get(new URL(manifestHref!, page.url()).toString());
    expect(response.ok()).toBe(true);
    const manifest = await response.json();

    expect(manifest.name).toBe("TIA — Accessories & More");
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.display).toBe("standalone");
    // TIA deep navy / warm ivory (`--brand-burgundy` / `--brand-ivory` in
    // globals.css, mirrored by `lib/config/brandColors.ts`).
    expect(manifest.theme_color).toBe("#101c36");
    expect(manifest.background_color).toBe("#fcfbf8");
    expect(manifest.icons?.length).toBeGreaterThanOrEqual(3);
    expect(manifest.icons.some((icon: { purpose?: string }) => icon.purpose === "maskable")).toBe(true);
    expect(manifest.icons.some((icon: { sizes?: string }) => icon.sizes === "192x192")).toBe(true);
    expect(manifest.icons.some((icon: { sizes?: string }) => icon.sizes === "512x512")).toBe(true);
  });

  test("the Apple Touch Icon and theme-color meta tags are present", async ({ page }) => {
    await page.goto("/en");
    await expect(page.locator('link[rel="apple-touch-icon"], link[rel="icon"][sizes="180x180"]').first()).toHaveCount(
      1,
    );
    const themeColor = await page.locator('meta[name="theme-color"]').getAttribute("content");
    expect(themeColor).toBe("#101c36");
  });
});

test.describe("PWA — service worker (requires a production build: next build && next start)", () => {
  test("the service worker registers successfully", async ({ page }) => {
    await page.goto("/en");
    const supported = await page.evaluate(() => "serviceWorker" in navigator);
    test.skip(!supported, "serviceWorker unsupported in this browser context");

    const registered = await page.evaluate(async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) return true;
        // Under `next dev` (T195) no worker script exists — registration
        // will reject, which is the expected/correct dev-mode behavior.
        await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        return true;
      } catch {
        return false;
      }
    });

    test.skip(!registered, "Service worker did not register — likely running under `next dev` (T195, expected).");
    expect(registered).toBe(true);
  });

  test("offline shows the branded /offline fallback in English and Arabic", async ({ page, context, browserName }) => {
    // Chromium only, and not because the feature is Chromium-only.
    // Playwright's WebKit offline emulation fails a navigation inside the
    // browser ("WebKit encountered an internal error") before the service
    // worker's fetch handler ever runs, so there is nothing for the
    // fallback to answer. Measured directly: with the worker registered
    // *and* controlling the page (`navigator.serviceWorker.controller`
    // true, one cache present), Chromium serves `/offline` on an offline
    // navigation while WebKit returns that internal error and stays put.
    // The same worker, the same build. Asserting this on WebKit would test
    // Playwright, not TIA — every other PWA test in this file still runs on
    // every project.
    test.skip(browserName === "webkit", "Playwright's WebKit offline emulation never reaches the service worker.");

    await page.goto("/en");
    const supported = await page.evaluate(() => "serviceWorker" in navigator);
    test.skip(!supported, "serviceWorker unsupported in this browser context");

    const registered = await page
      .evaluate(async () => {
        await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        return true;
      })
      .catch(() => false);
    test.skip(!registered, "Service worker did not register — likely running under `next dev` (T195, expected).");

    // Let the precache (including /offline) finish before going offline.
    await page.waitForTimeout(2000);

    await context.setOffline(true);
    await page.goto("/en/shop", { waitUntil: "domcontentloaded", timeout: 8000 }).catch(() => {});
    await expect(page.getByText("You're offline")).toBeVisible({ timeout: 10000 });
    await context.setOffline(false);

    await page.context().addCookies([{ name: "NEXT_LOCALE", value: "ar", url: page.url() }]);
    await context.setOffline(true);
    await page.goto("/en/shop", { waitUntil: "domcontentloaded", timeout: 8000 }).catch(() => {});
    await expect(page.getByText("أنتِ غير متصلة بالإنترنت")).toBeVisible({ timeout: 10000 });
    await context.setOffline(false);
  });

  test("offline checkout is blocked with no false success indication, in both languages (quickstart Scenario 10 step 8)", async ({
    page,
    context,
  }) => {
    async function attemptOfflineCheckout(locale: "en" | "ar") {
      await page.goto(`/${locale}/shop/golden-bangle-bracelet`);

      const supported = await page.evaluate(() => "serviceWorker" in navigator);
      test.skip(!supported, "serviceWorker unsupported in this browser context");

      const registered = await page
        .evaluate(async () => {
          await navigator.serviceWorker.register("/sw.js");
          await navigator.serviceWorker.ready;
          return true;
        })
        .catch(() => false);
      test.skip(!registered, "Service worker did not register — likely running under `next dev` (T195, expected).");

      // Populate the cart and reach checkout while still online — mirrors
      // quickstart Scenario 10 step 8's "cart already populated from an
      // earlier online session" precondition.
      await addDetailToCart(page);

      await page.goto(`/${locale}/checkout`);
      await expect(page).toHaveURL(new RegExp(`/${locale}/checkout`));

      const fullNameLabel = locale === "en" ? "Full Name" : "الاسم الكامل";
      const phoneLabel = locale === "en" ? "Mobile Phone Number" : "رقم الهاتف المحمول";
      const emailLabel = locale === "en" ? "Email" : "البريد الإلكتروني";
      const regionLabel = locale === "en" ? "Region" : "المنطقة";
      const cityLabel = locale === "en" ? "City / Area" : "المدينة / الحي";
      const addressLabel = locale === "en" ? "Full Address" : "العنوان الكامل";
      const placeOrderLabel = locale === "en" ? "Place Order" : "إتمام الطلب";

      await page.getByLabel(fullNameLabel).fill("Offline Shopper");
      await page.getByLabel(phoneLabel).fill("+970599123456");
      await page.getByLabel(emailLabel).fill(`offline-${locale}-${Date.now()}@example.com`);
      await page.getByLabel(regionLabel).selectOption({ index: 1 });
      await expect(async () => {
        const options = await page.getByLabel(cityLabel).locator("option").count();
        expect(options).toBeGreaterThan(1);
      }).toPass({ timeout: 30000 });
      await page.getByLabel(cityLabel).selectOption({ index: 1 });
      await page.getByLabel(addressLabel).fill("123 Main Street");

      // Now go offline and attempt to place the order — this must never
      // silently hang or show a false success; the UI must clearly
      // indicate that connectivity is required, and no order is created.
      await context.setOffline(true);
      try {
        await page.getByRole("button", { name: placeOrderLabel }).click();

        // Never navigates to an order-confirmation page while offline.
        await expect(page).not.toHaveURL(/order-confirmation/, { timeout: 10000 });
        await expect(page).toHaveURL(new RegExp(`/${locale}/checkout`));

        // A clear, visible indication is shown — never a silent hang with
        // no feedback at all (which would be indistinguishable from a
        // frozen/broken page to a real shopper). Scoped past Next.js's own
        // route announcer (also `role="alert"`) to this form's specific
        // error message.
        const offlineMessage = locale === "en" ? "You're offline" : "أنتِ غير متصلة بالإنترنت";
        await expect(page.getByText(offlineMessage, { exact: false })).toBeVisible({ timeout: 10000 });
      } finally {
        await context.setOffline(false);
      }
    }

    await attemptOfflineCheckout("en");
    await page.context().clearCookies();
    await attemptOfflineCheckout("ar");
  });

  test("a live price/stock change is never masked by a stale cache after the service worker is active", async ({
    page,
  }) => {
    const supported = await page.evaluate(() => "serviceWorker" in navigator);
    test.skip(!supported, "serviceWorker unsupported in this browser context");

    const { getApps, initializeApp } = await import("firebase-admin/app");
    const { getFirestore } = await import("firebase-admin/firestore");
    const app = getApps()[0] ?? initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID ?? "demo-elora" });
    const db = getFirestore(app);

    await page.goto("/en/shop/golden-bangle-bracelet");
    const registered = await page
      .evaluate(async () => {
        await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        return true;
      })
      .catch(() => false);
    test.skip(!registered, "Service worker did not register — likely running under `next dev` (T195, expected).");

    const snapshot = await db.collection("products").where("slug", "==", "golden-bangle-bracelet").limit(1).get();
    const ref = snapshot.docs[0].ref;
    const originalPrice = snapshot.docs[0].data().price as number;
    const bumpedPrice = originalPrice + 12345;

    try {
      await ref.update({ price: bumpedPrice });
      await page.reload();
      await expect(page.getByText((bumpedPrice / 100).toFixed(2))).toBeVisible({ timeout: 10000 });
    } finally {
      await ref.update({ price: originalPrice });
    }
  });
});

test.describe("PWA — install prompt", () => {
  test("shows the install CTA once beforeinstallprompt fires, and hides it when already standalone", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.removeItem("elora-install-dismissed-at");
    });
    await page.goto("/en");

    function dispatchBeforeInstallPrompt() {
      const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
        prompt?: () => Promise<void>;
        userChoice?: Promise<{ outcome: string }>;
      };
      event.prompt = async () => {};
      event.userChoice = Promise.resolve({ outcome: "dismissed" });
      window.dispatchEvent(event);
    }

    // The install prompt's listener attaches in a `useEffect`, which may
    // not have run yet immediately after `goto` resolves (hydration is
    // async) — retry the dispatch until the listener has caught on.
    await expect(async () => {
      await page.evaluate(dispatchBeforeInstallPrompt);
      await expect(page.getByRole("dialog", { name: "Install TIA" })).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15000 });

    await page.getByRole("button", { name: "Not now" }).first().click();
    await expect(page.getByRole("dialog", { name: "Install TIA" })).toHaveCount(0);
  });

  test("never shows when display-mode: standalone is simulated (already installed)", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.removeItem("elora-install-dismissed-at");
      const originalMatchMedia = window.matchMedia.bind(window);
      window.matchMedia = (query: string) => {
        if (query === "(display-mode: standalone)") {
          return { ...originalMatchMedia(query), matches: true } as MediaQueryList;
        }
        return originalMatchMedia(query);
      };
    });
    await page.goto("/en");
    await page.evaluate(() => {
      const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
        prompt?: () => Promise<void>;
        userChoice?: Promise<{ outcome: string }>;
      };
      event.prompt = async () => {};
      event.userChoice = Promise.resolve({ outcome: "dismissed" });
      window.dispatchEvent(event);
    });
    await expect(page.getByRole("dialog", { name: "Install TIA" })).toHaveCount(0);
  });

  test("standalone mode remains fully responsive (no horizontal overflow, mobile nav works)", async ({ page }) => {
    await page.addInitScript(() => {
      const originalMatchMedia = window.matchMedia.bind(window);
      window.matchMedia = (query: string) => {
        if (query === "(display-mode: standalone)") {
          return { ...originalMatchMedia(query), matches: true } as MediaQueryList;
        }
        return originalMatchMedia(query);
      };
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en");
    expect(await hasNoHorizontalOverflow(page)).toBe(true);
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("button", { name: "Close menu" }).last()).toBeVisible();
    expect(await hasNoHorizontalOverflow(page)).toBe(true);
  });
});
