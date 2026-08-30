import { test, expect } from "./fixtures/base";
import AxeBuilder from "@axe-core/playwright";

/**
 * Automated accessibility check (T226) — runs axe-core's WCAG 2.1 AA
 * ruleset against the key storefront routes in both locales, plus the
 * admin sign-in page. This project has no CI pipeline to plug a
 * Lighthouse-against-a-live-URL check into (there is no deployed preview
 * target), so per the same honest-gap treatment used for the Phase 12
 * Lighthouse-CI task, the genuinely achievable piece — an automated
 * axe scan wired into the existing local/CI-capable Playwright suite —
 * is implemented here instead of a Lighthouse-CI config that would have
 * nothing real to point at.
 */
test.describe("accessibility (axe)", () => {
  for (const locale of ["en", "ar"] as const) {
    test(`home page has no critical/serious axe violations (${locale})`, async ({ page }) => {
      await page.goto(`/${locale}`);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      const blocking = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
      expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
    });

    test(`shop page has no critical/serious axe violations (${locale})`, async ({ page }) => {
      await page.goto(`/${locale}/shop`);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      const blocking = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
      expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
    });
  }

  test("admin sign-in page has no critical/serious axe violations", async ({ page }) => {
    await page.goto("/admin");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const blocking = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });
});
