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
const SPLASH_DISMISS_TIMEOUT_MS = 3000;
const PATCHED = Symbol("elora-welcome-splash-dismiss-patched");

async function dismissWelcomeSplashIfPresent(page: Page): Promise<void> {
  const dialog = page.locator("dialog[open]");
  const appeared = await dialog
    .waitFor({ state: "visible", timeout: SPLASH_APPEAR_TIMEOUT_MS })
    .then(() => true)
    .catch(() => false);
  if (!appeared) return;

  // WelcomeSplash's dialog contains exactly one `<button>` — its "Shop Now"
  // control — located structurally so this works identically under English
  // and Arabic without hardcoding either locale's text, and never matches
  // the WhatsApp action (an `<a>`, deliberately left alone).
  await dialog
    .locator("button")
    .first()
    .click({ timeout: 2000 })
    .catch(() => {});
  await dialog.waitFor({ state: "hidden", timeout: SPLASH_DISMISS_TIMEOUT_MS }).catch(() => {});
}

function patchPageGoto(page: Page): void {
  const tagged = page as Page & { [PATCHED]?: true };
  if (tagged[PATCHED]) return;
  tagged[PATCHED] = true;

  const originalGoto = page.goto.bind(page);
  page.goto = (async (...args: Parameters<Page["goto"]>) => {
    const response = await originalGoto(...args);
    await dismissWelcomeSplashIfPresent(page);
    return response;
  }) as Page["goto"];
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
