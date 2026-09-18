import { expect, type Page } from "@playwright/test";

/**
 * Switches the storefront to Arabic through the one visible EN | AR
 * control the site offers at every viewport — the first-entry welcome
 * screen (the header and the phone/tablet menu carry no language
 * switcher). Never a URL shortcut.
 *
 * The shared fixture auto-dismisses the welcome screen after every
 * `goto()`, so it is brought back the way a new session would see it —
 * clear its session flag and reload (reload is not auto-dismissed) — then
 * AR is chosen on it and the customer enters with the Arabic CTA.
 *
 * Leaves the page on the Arabic storefront with the welcome screen closed.
 */
export async function switchToArabicWithAvailableControl(page: Page): Promise<void> {
  await page.evaluate(() => window.sessionStorage.removeItem("elora_welcome_shown"));
  await page.reload();

  const dialog = page.getByRole("dialog", { name: "Welcome to TIA" });
  await expect(dialog.getByRole("button", { name: "Enter the Collection" })).toBeEnabled();
  await dialog.getByRole("button", { name: "AR", exact: true }).click();

  const arabicDialog = page.getByRole("dialog", { name: "مرحبًا بكِ في تيا" });
  const enter = arabicDialog.getByRole("button", { name: "ادخلي إلى المجموعة" });
  await expect(enter).toBeEnabled();
  await enter.click();
  await expect(arabicDialog).toBeHidden();
}
