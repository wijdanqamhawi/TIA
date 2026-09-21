import { test as base, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

export type { Page } from "@playwright/test";

/**
 * Shared Playwright test setup (not a WelcomeSplash-specific hack): every
 * spec file in this suite should `import { test, expect } from
 * "./fixtures/base"` instead of `"@playwright/test"` directly. In exchange,
 * every `Page` this fixture hands out — however it was created (the
 * default `page` fixture, a `context.newPage()`, or a fully manual
 * `browser.newContext()` → `context.newPage()`, all patterns already used
 * across this suite) — automatically dismisses the storefront's
 * `WelcomeSplash` (`src/components/storefront/WelcomeSplash.tsx`) the
 * moment it appears after any `page.goto()`, so no individual spec has to
 * know or care that it exists.
 *
 * WelcomeSplash's own behavior is untouched: it is a genuine, full-screen
 * `<dialog>` (`showModal()`) shown at most once per browser-tab session, on
 * the very first page load only (gated by its own `sessionStorage` check —
 * never a cookie, never disabled or bypassed here), with **no** auto-dismiss
 * and **no** other way to close it — clicking its "Shop Now" / "تسوّق الآن"
 * button is the only path out (not Escape, not a background click, and not
 * its second action, "WhatsApp" / "تواصل معنا عبر واتساب", which is a
 * `target="_blank"` link that intentionally leaves the screen open). This
 * helper does not suppress, fake, or shortcut any of that; it clicks
 * specifically the dialog's `<button>` element (there is exactly one — the
 * WhatsApp action is an `<a>`, never matched here, so this can never
 * accidentally spawn a WhatsApp popup during an unrelated test), located
 * structurally rather than by hardcoded text so it works identically under
 * English and Arabic. On every navigation after the first in a given
 * browser-tab session, WelcomeSplash's own `sessionStorage` gate means it
 * never appears again, so this is a fast, single-locator no-op there.
 *
 * `browser`, `context`, and `page` are patched independently below (not
 * just one of them) because Playwright's own built-in fixtures form a
 * chain — `page` is built from `context`, which is built from `browser` —
 * and different specs in this suite obtain a `Page` at every level of that
 * chain (the default `page` fixture; a manual `context.newPage()`; a fully
 * manual `browser.newContext()` → `context.newPage()`). Since patching one
 * level's `newContext`/`newPage` naturally produces an object that a
 * *higher* level's patch would then patch again, every patch function below
 * is idempotent (tags the exact object instance it touches) — this is
 * deliberate defense-in-depth against relying on exactly how Playwright
 * wires its own fixtures internally, not a bug to "simplify away": an
 * earlier version without idempotency guards genuinely double-wrapped
 * `page.goto` and caused a real navigation abort under load.
 *
 * `tests/e2e/welcome-splash.spec.ts` deliberately imports from
 * `"@playwright/test"` directly, not from here, since it is the one spec
 * that must observe WelcomeSplash's real, undismissed behavior.
 */

const SPLASH_APPEAR_TIMEOUT_MS = 1500;
const SPLASH_DISMISS_TIMEOUT_MS = 15000;
const SPLASH_HYDRATION_TIMEOUT_MS = 15000;
const PATCHED = Symbol("elora-welcome-splash-dismiss-patched");

/** Routes rendered by the `[locale]` storefront layout — the only layout that mounts WelcomeSplash. */
const STOREFRONT_PATH = /^\/(en|ar)(\/|$)/;

async function dismissWelcomeSplashIfPresent(page: Page): Promise<void> {
  // WelcomeSplash decides whether to open inside a client effect, and writes
  // its `elora_welcome_shown` session key in that same effect — i.e. only
  // once the page has hydrated. `goto` resolves at `load`, which on WebKit
  // against the dev server can be ~1.5–2 s *before* hydration, so a fixed
  // appear-timeout alone could give up just before the splash opened and
  // leave it covering the page. On storefront routes, wait for the splash's
  // own "effect has run" signal first; the appear check below then catches
  // the open that immediately follows it. After the first navigation in a
  // session the key already exists, so this returns at once.
  let pathname = "";
  try {
    pathname = new URL(page.url()).pathname;
  } catch {
    // about:blank or an unparsable URL — not a storefront page.
  }
  if (STOREFRONT_PATH.test(pathname)) {
    // The screen is server-rendered open, but its ENTER button only works
    // once hydrated. Wait until either the session has already entered
    // (the pre-paint script marks <html>) or the screen reports itself
    // ready, so the click below is never lost on inert markup.
    await page
      .waitForFunction(
        () =>
          document.documentElement.hasAttribute("data-tia-entered") ||
          document.querySelector("dialog[data-welcome-splash][data-ready]") !== null,
        undefined,
        { timeout: SPLASH_HYDRATION_TIMEOUT_MS },
      )
      .catch(() => {});
  }

  const dialog = page.locator("dialog[open]");
  const appeared = await dialog
    .waitFor({ state: "visible", timeout: SPLASH_APPEAR_TIMEOUT_MS })
    .then(() => true)
    .catch(() => false);
  if (!appeared) return;

  // WelcomeSplash's first `<button>` is its ENTER THE COLLECTION control
  // (the EN | AR switch buttons follow it in the DOM) — located
  // structurally so this works identically under English and Arabic
  // without hardcoding either locale's text.
  //
  // Clicked once the screen reports itself hydrated, then waited out its
  // closing animation. A fire-and-forget click was enough while navigation
  // waited for `load`; settling on `domcontentloaded` lets that click land
  // on inert markup, do nothing, and leave a full-screen dialog to swallow
  // the test's first real click (`desktop-flow` timed out on the header's
  // Shop link with the splash's own container named as the interceptor).
  // Re-clicking blindly is worse: the screen sets `data-leaving` while it
  // fades, and clicking again during that restarts the close and the
  // dialog never goes away.
  await page
    .locator("dialog[data-welcome-splash][data-ready]")
    .waitFor({ state: "visible", timeout: SPLASH_HYDRATION_TIMEOUT_MS })
    .catch(() => {});
  await dialog
    .locator("button")
    .first()
    .click({ timeout: 5000 })
    .catch(() => {});
  await dialog.waitFor({ state: "hidden", timeout: SPLASH_DISMISS_TIMEOUT_MS }).catch(() => {});
}

/**
 * A `goto` whose load was superseded is not a broken page: the storefront's
 * own client-side navigation (a locale or delivery-location redirect, a
 * `router.refresh()` from a Server Action that is still settling) can start
 * while the requested navigation is in flight, and the browser reports the
 * abandoned one as an error — `net::ERR_ABORTED` on Chromium, "interrupted
 * by another navigation" on WebKit. The shopper simply ends up on the page;
 * a spec should too. Only these are retried, and only a couple of times —
 * anything else, including a genuine timeout, propagates untouched.
 */
const SUPERSEDED_NAVIGATION = /ERR_ABORTED|interrupted by another navigation/;

async function gotoWithAbortRetry(
  goto: Page["goto"],
  args: Parameters<Page["goto"]>,
): Promise<Awaited<ReturnType<Page["goto"]>>> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await goto(...args);
    } catch (error) {
      const message = String((error as Error)?.message ?? error);
      if (!SUPERSEDED_NAVIGATION.test(message)) throw error;
      lastError = error;
    }
  }
  throw lastError;
}

/**
 * Every navigation in this suite settles on `domcontentloaded`, not `load`.
 *
 * `load` waits for the last subresource — including decorative imagery
 * served through `/_next/image`. On WebKit against a 2-vCPU CI runner one
 * of those occasionally never settles, and the event then never fires: 24
 * failures in run 35576930578, 7 more in 35591830915 (the second with a
 * single worker, which ruled out contention). Each time the pending
 * request was a different image at a different width — the constant was
 * the wait, not the picture.
 *
 * No test needs that wait. Every one of them follows its navigation with
 * explicit, auto-retrying assertions on the UI it is about to interrogate,
 * which is both a stronger readiness signal and the one the test actually
 * depends on. Waiting for a hero photograph to finish decoding proved
 * nothing and could only fail. An explicit `waitUntil` passed by a caller
 * still wins — `pwa.spec.ts` relies on that.
 */
const DEFAULT_WAIT_UNTIL = "domcontentloaded" as const;

function patchPageGoto(page: Page): void {
  const tagged = page as Page & { [PATCHED]?: true };
  if (tagged[PATCHED]) return;
  tagged[PATCHED] = true;

  const originalGoto = page.goto.bind(page);
  page.goto = (async (url: string, options?: Parameters<Page["goto"]>[1]) => {
    const response = await gotoWithAbortRetry(originalGoto, [url, { waitUntil: DEFAULT_WAIT_UNTIL, ...options }]);
    await dismissWelcomeSplashIfPresent(page);
    return response;
  }) as Page["goto"];

  // `reload` gets the same `domcontentloaded` default and, deliberately,
  // *not* the splash dismissal. `fixtures/language.ts` brings the welcome
  // screen back the only way a shopper could — clear its session flag and
  // reload — because below `lg` its EN | AR is the sole language control
  // in the approved design. Dismissing on reload as well removed that
  // control before the test could use it and took out four tests on every
  // Chromium project in run 35615438938.
  const originalReload = page.reload.bind(page);
  page.reload = (async (options?: Parameters<Page["reload"]>[0]) => {
    return originalReload({ waitUntil: DEFAULT_WAIT_UNTIL, ...options });
  }) as Page["reload"];
}

function patchContextNewPage(context: BrowserContext): void {
  const tagged = context as BrowserContext & { [PATCHED]?: true };
  if (tagged[PATCHED]) return;
  tagged[PATCHED] = true;

  const originalNewPage = context.newPage.bind(context);
  context.newPage = (async (...args: Parameters<BrowserContext["newPage"]>) => {
    const page = await originalNewPage(...args);
    patchPageGoto(page);
    return page;
  }) as BrowserContext["newPage"];
}

function patchBrowserNewContextAndNewPage(browser: Browser): void {
  const tagged = browser as Browser & { [PATCHED]?: true };
  if (tagged[PATCHED]) return;
  tagged[PATCHED] = true;

  const originalNewContext = browser.newContext.bind(browser);
  browser.newContext = (async (...args: Parameters<Browser["newContext"]>) => {
    const context = await originalNewContext(...args);
    patchContextNewPage(context);
    return context;
  }) as Browser["newContext"];

  const originalNewPage = browser.newPage.bind(browser);
  browser.newPage = (async (...args: Parameters<Browser["newPage"]>) => {
    const page = await originalNewPage(...args);
    patchPageGoto(page);
    return page;
  }) as Browser["newPage"];
}

export const test = base.extend({
  browser: async ({ browser }, use) => {
    patchBrowserNewContextAndNewPage(browser);
    await use(browser);
  },
  context: async ({ context }, use) => {
    patchContextNewPage(context);
    await use(context);
  },
  page: async ({ page }, use) => {
    patchPageGoto(page);
    await use(page);
  },
});

export { expect };
