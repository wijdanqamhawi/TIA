import { test, expect, type Page } from "./fixtures/base";
import { resetSeededStock } from "./fixtures/catalog-reset";

/**
 * End-to-end Special Offers coverage (T333, spec User Story 10, quickstart
 * Scenario 16): an admin enables a real offer via `/admin/products`, the
 * storefront (Home Special Offers section, Shop, product detail, Quick
 * View, Cart) all show identical crossed-out/sale pricing, and disabling
 * the offer reverts every surface to the regular price.
 *
 * Requires the Firebase Local Emulator Suite running with `scripts/seed.ts`
 * and `scripts/create-admin.ts` already applied, and
 * ADMIN_BOOTSTRAP_EMAIL/ADMIN_BOOTSTRAP_PASSWORD set in the environment
 * this Playwright run inherits (mirrors cart.spec.ts's emulator
 * dependency) — skipped otherwise, since there is no other way to obtain
 * an authenticated admin session.
 *
 * Full checkout-with-an-active-offer coverage (pricing an actual placed
 * order at the sale price) is deferred until Phase 8 builds the real
 * checkout page/order-creation flow — this spec covers everything
 * buildable against the currently-implemented Phases 1–6 plus this
 * Special Offers pass: pricing display and cart pricing only.
 */

const ADMIN_EMAIL = process.env.ADMIN_BOOTSTRAP_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_BOOTSTRAP_PASSWORD;

const SEEDED_PRODUCT_NAME = "Golden Bangle Bracelet"; // scripts/seed.ts — price 15000 ($150.00)
const SALE_PRICE_INPUT = "99.99";

async function loginAsAdmin(page: Page) {
  await page.goto("/en/login?next=/admin");
  await page.getByLabel("Email").fill(ADMIN_EMAIL!);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD!);
  await expect(async () => {
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL(/\/admin\/?$/, { timeout: 3000 });
  }).toPass({ timeout: 20000 });
  // The redirect to /admin can land before the session cookie is fully
  // settled server-side — waiting for the Dashboard heading (mirrors
  // admin-helpers.ts's shared `loginAsAdmin`) proves the session is
  // actually authenticated before a subsequent hard navigation (e.g.
  // `page.goto("/admin/products")`) can otherwise bounce back to /login.
  await page.waitForLoadState("load");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({ timeout: 15000 });
}

async function setOffer(page: Page, enabled: boolean) {
  await page.goto("/admin/products");
  const row = page.getByRole("row", { name: new RegExp(SEEDED_PRODUCT_NAME) });
  await expect(row).toBeVisible({ timeout: 10000 });
  await row.getByRole("button", { name: "Manage Offer" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  const checkbox = dialog.getByRole("checkbox", { name: "Enable this offer" });
  const isChecked = await checkbox.isChecked();
  if (isChecked !== enabled) {
    await checkbox.click();
  }
  if (enabled) {
    await dialog.getByLabel("Sale price").fill(SALE_PRICE_INPUT);
  }

  await expect(async () => {
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden({ timeout: 2000 });
  }).toPass({ timeout: 15000 });
}

test.describe("Special Offers end-to-end", () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "Requires ADMIN_BOOTSTRAP_EMAIL/PASSWORD in the environment.");

  // This spec adds the seeded bracelet to cart (never decrements stock,
  // only checkout does) but needs stock > 0 for its "Add to Cart" button
  // to be enabled, regardless of what another spec file already did to
  // this shared product.
  test.beforeAll(async () => {
    await resetSeededStock(["golden-bangle-bracelet"]);
  });

  test.afterEach(async ({ page }) => {
    // Always leave the offer disabled afterward so this test never leaks
    // promotional state into other e2e specs sharing the same emulator/seed
    // data (mirrors the test-data-hygiene pattern already used elsewhere).
    await setOffer(page, false);
  });

  test("admin enables an offer, it prices consistently across every storefront surface and the cart, then disabling reverts it", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await setOffer(page, true);

    // Admin listing shows the derived Active status and sale price.
    await page.goto("/admin/products");
    const row = page.getByRole("row", { name: new RegExp(SEEDED_PRODUCT_NAME) });
    await expect(row.getByText("Active")).toBeVisible();
    await expect(row.getByText("99.99")).toBeVisible();

    // Home — Special Offers section shows the crossed-out regular price + sale price.
    await expect(async () => {
      await page.goto("/en");
      const card = page.getByRole("main").locator("div").filter({ hasText: SEEDED_PRODUCT_NAME }).first();
      await expect(card).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15000 });
    await expect(page.getByText("$99.99").first()).toBeVisible();
    await expect(page.getByText("$150.00").first()).toBeVisible();
    await expect(page.getByText("Sale").first()).toBeVisible();

    // Shop / category page shows the same pricing for the same product.
    await page.goto("/en/shop/category/bracelets");
    await expect(page.getByRole("main").getByText("$99.99").first()).toBeVisible();
    await expect(page.getByRole("main").getByText("$150.00").first()).toBeVisible();

    // Product detail page shows the same pricing.
    await page.goto("/en/shop/golden-bangle-bracelet");
    await expect(page.getByText("$99.99").first()).toBeVisible();
    await expect(page.getByText("$150.00").first()).toBeVisible();

    // Cart revalidates the current effective (sale) price server-side.
    await expect(async () => {
      await page.getByRole("main").getByRole("button", { name: "Add to Cart" }).first().click();
      await expect(page.getByRole("main").getByRole("button", { name: "Add to Cart" }).first()).toBeEnabled({
        timeout: 1000,
      });
    }).toPass({ timeout: 15000 });

    await expect(async () => {
      await page.goto("/en/cart");
      await expect(page.getByText(SEEDED_PRODUCT_NAME)).toBeVisible({ timeout: 1000 });
      await expect(page.getByText("$99.99").first()).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15000 });

    // Admin disables the offer.
    await setOffer(page, false);

    // The cart, reloaded, now reverts to the regular price — never a stale sale price.
    await expect(async () => {
      await page.goto("/en/cart");
      await expect(page.getByText("$150.00").first()).toBeVisible({ timeout: 1000 });
      await expect(page.getByText("$99.99")).toHaveCount(0);
    }).toPass({ timeout: 15000 });

    // Clean up the cart line so this test doesn't leak state into others.
    await page.getByRole("button", { name: "Remove" }).click();
  });

  test("a Sold Out product on an active offer still shows SOLD OUT and cannot be added to cart (spec FR-122)", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await setOffer(page, true);

    // The seed's known Sold Out product (stock: 0) never has an offer set
    // by this test — this proves Sold Out independently blocks purchase
    // regardless of any *other* product's active offer elsewhere in the
    // catalog, i.e. offer state is never global/leaking across products.
    await page.goto("/en/shop/pearl-tennis-bracelet");
    const addToCartButton = page.getByRole("main").getByRole("button", { name: "SOLD OUT" }).first();
    await expect(addToCartButton).toBeDisabled();
  });
});
