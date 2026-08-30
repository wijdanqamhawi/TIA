import { test, expect } from "./fixtures/base";
import { loginAsAdmin, registerNewCustomer } from "./admin-helpers";

/**
 * T179 (quickstart Scenario 7): a normal customer attempting an admin
 * route/action is rejected server-side, not just UI-hidden — the nav link
 * being absent from her UI is never the actual enforcement (Constitution
 * Principle 6). Also proves the admin route works for an actual admin, so
 * the negative case isn't confounded with a broken route.
 */
test.describe("admin authorization", () => {
  test("a guest is redirected to login when visiting an admin route", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login\?next=/);
  });

  test("a registered non-admin customer is redirected away from /admin, never shown the dashboard", async ({ page }) => {
    await registerNewCustomer(page, "Regular Customer", `authz-${Date.now()}`);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login\?next=/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toHaveCount(0);
  });

  test("a registered non-admin customer is rejected from a nested admin route by direct URL, not just the dashboard root", async ({
    page,
  }) => {
    await registerNewCustomer(page, "Regular Customer", `authz-nested-${Date.now()}`);

    // `requireAdmin()` runs in `AdminLayout`, which wraps every `/admin/*`
    // route — this proves the enforcement isn't only on `/admin` itself,
    // by hitting a deep child route directly via URL (never through a
    // rendered nav link this customer never sees).
    await page.goto("/admin/products/new");
    await expect(page).toHaveURL(/\/login\?next=/);
    await expect(page.getByLabel("Name — English")).toHaveCount(0);
  });

  test("the seeded admin account can reach the dashboard", async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });
});
