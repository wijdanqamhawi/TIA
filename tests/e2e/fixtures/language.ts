import { expect, type Page } from "@playwright/test";

/**
 * Switches the storefront to Arabic through whichever EN | AR control is
 * genuinely available in the current UI state. Never a URL shortcut.
 *
 * There are exactly two in the approved design, and which one exists is a
 * property of the viewport, not of the test:
 *
 *  - From `lg` up, the announcement bar carries the switch —
 *    `AnnouncementBar` renders `LanguageSwitcher` inside a
 *    `hidden … lg:flex` container, so ≥1024px only. The `laptop` and
 *    `desktop` projects see it.
 *  - Below `lg` — `mobile`, `mobile-ios`, `tablet` — the header and the
 *    phone/tablet menu deliberately carry none, and the first-entry
 *    welcome screen's EN | AR is the only control there is.
 *    `language-switching.spec.ts` asserts that absence as correct.
 *
 * The state is read immediately, never probed with a timeout: `isVisible`
 * is a single non-retrying DOM check, so a viewport that has no welcome
 * screen costs nothing and a viewport that has no announcement-bar switch
 * costs nothing either.
 *
 * Leaves the page on the Arabic storefront with no welcome screen open.
 */
export async function switchToArabicWithAvailableControl(page: Page): Promise<void> {
  // Case A — the welcome screen is on screen right now. Use it, and use it
  // first: it covers the whole viewport, so the announcement bar behind it
  // is present in the DOM but unclickable.
  if (await welcomeScreen(page).isVisible().catch(() => false)) {
    await chooseArabicOnWelcomeScreen(page);
    return;
  }

  // Case B — no welcome screen. From `lg` up the announcement bar has the
  // real control; use it exactly as a shopper would.
  const barSwitch = page.getByRole("banner").getByRole("button", { name: "AR", exact: true });
  if (await barSwitch.isVisible().catch(() => false)) {
    await barSwitch.click();
    await expectArabicStorefront(page);
    return;
  }

  // Below `lg` with the screen already entered, the session's one control
  // is behind its own session flag. Start the session over — the state a
  // returning-as-new shopper sees — rather than inventing a control the
  // design does not have.
  await startFreshSession(page);
  await chooseArabicOnWelcomeScreen(page);
}

/** The first-entry welcome screen, in either language. */
function welcomeScreen(page: Page) {
  return page.getByRole("dialog", { name: /Welcome to TIA|مرحبًا بكِ في تيا/ });
}

/**
 * Restores the state a first-time visitor sees, so the welcome screen —
 * the only language control below `lg` — is legitimately present.
 *
 * `fixtures/base.ts` auto-dismisses the screen after `goto` but
 * deliberately not after `reload`, which is what makes this deterministic.
 */
export async function startFreshSession(page: Page): Promise<void> {
  await page.evaluate(() => window.sessionStorage.removeItem("elora_welcome_shown"));
  await page.reload();
  await expect(welcomeScreen(page)).toBeVisible();
}

/** Picks AR on the welcome screen and enters through its Arabic CTA. */
async function chooseArabicOnWelcomeScreen(page: Page): Promise<void> {
  const dialog = page.getByRole("dialog", { name: "Welcome to TIA" });
  // The screen's own readiness signal, so the click cannot land on markup
  // React has not wired up yet — one click, never a retry loop, which
  // would restart its closing animation.
  await expect(dialog.getByRole("button", { name: "Enter the Collection" })).toBeEnabled();
  await dialog.getByRole("button", { name: "AR", exact: true }).click();

  const arabicDialog = page.getByRole("dialog", { name: "مرحبًا بكِ في تيا" });
  const enter = arabicDialog.getByRole("button", { name: "ادخلي إلى المجموعة" });
  await expect(enter).toBeEnabled();
  await enter.click();
  await expect(arabicDialog).toBeHidden();
  await expectArabicStorefront(page);
}

async function expectArabicStorefront(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/ar(\/|$)/);
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
}
