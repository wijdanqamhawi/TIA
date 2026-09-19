import { test, expect } from "./fixtures/base";
import { loginAsAdmin, registerNewCustomer } from "./admin-helpers";
import fs from "node:fs/promises";

/**
 * Admin Excel Export end-to-end coverage (T311, quickstart Scenario 15):
 * an admin downloads each report type — including one with a filter, and
 * one filtered to an empty result set — and each is a valid, non-empty
 * (or validly-empty) `.xlsx` with the expected headers; a signed-in
 * non-admin and an unauthenticated request are both rejected with no file
 * produced.
 *
 * Requires the Firebase Local Emulator Suite running with `scripts/seed.ts`
 * already applied.
 */

const REPORT_TYPES = [
  "orders",
  "products",
  "inventory",
  "sold-out",
  "customers",
  "sales",
  "best-sellers",
  "delivery-locations",
] as const;

test.describe("admin Excel export", () => {
  test("admin downloads every report type as a real, non-empty .xlsx", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/exports");
    await expect(page.getByRole("heading", { name: "Exports" })).toBeVisible();

    for (const reportType of REPORT_TYPES) {
      await page.getByLabel("Report type").selectOption(reportType);

      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("button", { name: /Download/ }).click(),
      ]);

      expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
      const filePath = await download.path();
      expect(filePath).not.toBeNull();
      const stats = await fs.stat(filePath!);
      // A valid, minimal .xlsx (header row only, zero data rows) is still
      // several KB of zipped XML — this is a sanity floor against a
      // corrupt/empty response, not a data-volume assertion.
      expect(stats.size).toBeGreaterThan(1000);
    }
  });

  test("a report filtered to an empty result set still downloads a validly-empty, correctly-headered .xlsx", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/exports");

    await page.getByLabel("Report type").selectOption("best-sellers");
    // A one-day window far in the past matches no seeded order.
    // `exact: true` matters here: a substring match on "To" also matches
    // the Next.js dev-mode floating dev-tools button's accessible name
    // ("Open Next.js Dev **To**ols"), which isn't present in production —
    // without it this test only fails in dev mode, never in `next build &&
    // next start`, which is the confusing part.
    await page.getByLabel("From", { exact: true }).fill("2001-01-01");
    await page.getByLabel("To", { exact: true }).fill("2001-01-02");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /Download/ }).click(),
    ]);

    expect(download.suggestedFilename()).toBe("tia-best-sellers.xlsx");
    const filePath = await download.path();
    const stats = await fs.stat(filePath!);
    expect(stats.size).toBeGreaterThan(0);
  });

  test("a signed-in non-admin is rejected server-side with no file produced", async ({ page }) => {
    // A unique-per-run prefix (mirrors `admin-authz.spec.ts`'s own
    // `authz-${Date.now()}` pattern) — a fixed prefix collides across the
    // five sequential device projects in a `--workers=1` run: project 2's
    // first registration attempt reuses project 1's already-taken email,
    // forcing several failed retries before `registerNewCustomer`'s own
    // internal attempt-bump succeeds (or times out).
    const email = await registerNewCustomer(page, "Export Test Customer", `export-test-customer-${Date.now()}`);
    void email;

    const response = await page.request.get("/admin/api/export/products");
    expect(response.status()).toBe(403);
    expect(response.headers()["content-type"]).toContain("application/json");
  });

  test("an unauthenticated request is rejected with no file produced", async ({ browser }) => {
    // No session cookie at all — `middleware.ts`'s layer-1 cookie-presence
    // pre-filter (shared with every other `/admin/*` route, T179) redirects
    // to `/login` before this request ever reaches the route handler's own
    // `requireAdminForRoute()` check, which only runs for a request that
    // *does* carry a (possibly non-admin) session cookie. Either mechanism
    // satisfies "rejected server-side with no file produced" — this
    // asserts the actual one that fires here, not a JSON error shape that
    // never gets a chance to run.
    const context = await browser.newContext();
    const page = await context.newPage();

    const response = await page.request.get("/admin/api/export/products", { maxRedirects: 0 });
    expect([301, 302, 303, 307, 308]).toContain(response.status());
    expect(response.headers()["location"]).toContain("/login");
    expect(response.headers()["content-type"] ?? "").not.toContain("spreadsheetml");

    await context.close();
  });
});
