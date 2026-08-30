import { test, expect, type Page } from "./fixtures/base";
import { resetSeededStock } from "./fixtures/catalog-reset";

/**
 * Wishlist end-to-end coverage (T117, quickstart Scenario 2/3, spec User
 * Story 3): register → add to wishlist → survives a logout/login cycle →
 * move to cart. Also covers the guest-intent redirect (spec FR-033a,
 * research.md §7) and Sold-Out-stays-in-wishlist-but-cannot-move (spec
 * FR-032).
 *
 * Requires the Firebase Local Emulator Suite running with
 * `scripts/seed.ts` already applied — mirrors `tests/e2e/cart.spec.ts`.
 */

// "Move to cart" needs `golden-bangle-bracelet` in stock, and the Sold Out
// test needs `pearl-tennis-bracelet` to stay permanently at 0 — reset both
// to their seeded baseline regardless of what another spec file already
// did to either shared product.
test.beforeAll(async () => {
  await resetSeededStock(["golden-bangle-bracelet", "pearl-tennis-bracelet"]);
});

const PASSWORD = "supersecret123";

async function registerNewCustomer(page: Page, name: string, emailPrefix: string): Promise<string> {
  let attempt = 0;
  let email = "";
  // Preserves whatever `next`/`intent` query the current page already
  // carries (e.g. after a guest wishlist-intent redirect to `/login`) by
  // navigating relative to the current URL's query string, rather than a
  // bare `/en/register` that would silently drop it.
  const currentQuery = new URL(page.url()).search;
  await expect(async () => {
    attempt += 1;
    email = `${emailPrefix}-attempt${attempt}@example.com`;
    await page.goto(`/en/register${currentQuery}`);
    await page.getByLabel("Full Name").fill(name);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Create Account" }).click();
    // A generous timeout: the Server Action round trip (Firebase Auth +
    // Firestore user doc) plus the subsequent client-side
    // router.push/refresh can comfortably exceed a couple of seconds
    // under dev-mode/cold-compile load.
    await expect(page).not.toHaveURL(/\/register/, { timeout: 15000 });
  }).toPass({ timeout: 30000 });
  return email;
}

async function loginAs(page: Page, email: string) {
  await expect(async () => {
    await page.goto("/en/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });
  }).toPass({ timeout: 30000 });
}

/**
 * Adds a product to the wishlist from its own detail page, via the main
 * purchase panel's text "Add to Wishlist" button — not the category grid,
 * where `.first()` would pick whichever card the current sort happens to
 * render first (not necessarily this product). `.first()` here instead
 * disambiguates the main panel's button from a related product's
 * icon-only "Add to Wishlist" heart button further down the same page.
 */
async function addProductToWishlist(page: Page, slug: string) {
  await page.goto(`/en/shop/${slug}`);
  const addButton = page.getByRole("main").getByRole("button", { name: "Add to Wishlist" }).first();
  await expect(async () => {
    await addButton.click();
    // The button disables for the duration of the Server Action transition
    // (`wishlistPending`) and re-enables once it resolves — waiting for
    // that round trip, not just the click event, avoids navigating to
    // `/wishlist` before the mutation has actually persisted.
    await expect(addButton).toBeEnabled({ timeout: 5000 });
  }).toPass({ timeout: 15000 });
}

test.describe("wishlist — registered customer", () => {
  test("register, add a product to the wishlist, survive logout/login, then move it to cart", async ({ page }) => {
    const email = await registerNewCustomer(page, "Wishlist Tester", `wishlist-${Date.now()}`);

    await addProductToWishlist(page, "golden-bangle-bracelet");

    await expect(async () => {
      await page.goto("/en/wishlist");
      await expect(page.getByText("Golden Bangle Bracelet")).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 15000 });

    // Survives a logout/login cycle — clearing cookies simulates logout
    // (there is no dedicated storefront logout page/link yet, only the
    // admin one; Phase 9 will add a customer-facing one).
    await page.context().clearCookies();
    await page.goto("/en/wishlist");
    await expect(page).toHaveURL(/\/login/);

    await loginAs(page, email);
    await expect(async () => {
      await page.goto("/en/wishlist");
      await expect(page.getByText("Golden Bangle Bracelet")).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 15000 });

    // Move to cart.
    await expect(async () => {
      await page.getByRole("button", { name: "Move to Cart" }).click();
      await expect(page.getByText("Your wishlist is empty")).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 15000 });

    await page.goto("/en/cart");
    await expect(page.getByText("Golden Bangle Bracelet")).toBeVisible();
  });

  test("guest 'Add to Wishlist' redirects to login and completes the add after sign-in (spec FR-033a)", async ({
    page,
  }) => {
    await page.context().clearCookies();
    await page.goto("/en/shop/golden-bangle-bracelet");

    await expect(async () => {
      await page.getByRole("main").getByRole("button", { name: "Add to Wishlist" }).first().click();
      await expect(page).toHaveURL(/\/login\?.*intent=wishlist/, { timeout: 5000 });
    }).toPass({ timeout: 20000 });

    await registerNewCustomer(page, "Guest Wishlist Tester", `guest-wishlist-${Date.now()}`);

    await expect(async () => {
      await page.goto("/en/wishlist");
      await expect(page.getByText("Golden Bangle Bracelet")).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 15000 });
  });

  test("a Sold Out wishlist item cannot be moved to cart but remains in the wishlist (spec FR-032)", async ({
    page,
  }) => {
    await registerNewCustomer(page, "Sold Out Wishlist Tester", `sold-out-wishlist-${Date.now()}`);

    await addProductToWishlist(page, "pearl-tennis-bracelet");

    await page.goto("/en/wishlist");
    await expect(page.getByText("Pearl Tennis Bracelet")).toBeVisible();
    const moveButton = page.getByRole("button", { name: "SOLD OUT" });
    await expect(moveButton).toBeDisabled();

    // Reload to confirm it is still there (never silently removed).
    await page.reload();
    await expect(page.getByText("Pearl Tennis Bracelet")).toBeVisible();
  });

  test("removing a wishlist item works regardless of its current validity", async ({ page }) => {
    await registerNewCustomer(page, "Remove Wishlist Tester", `remove-wishlist-${Date.now()}`);

    await addProductToWishlist(page, "golden-bangle-bracelet");

    await page.goto("/en/wishlist");
    await expect(page.getByText("Golden Bangle Bracelet")).toBeVisible();

    await expect(async () => {
      await page.getByRole("button", { name: "Remove" }).first().click();
      await expect(page.getByText("Your wishlist is empty")).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 15000 });
  });

  test("Arabic wishlist page renders localized labels in RTL", async ({ page }) => {
    await registerNewCustomer(page, "Arabic Wishlist Tester", `ar-wishlist-${Date.now()}`);
    await page.goto("/ar/wishlist");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "قائمة أمنياتي", level: 1 })).toBeVisible();
  });
});

test.describe("wishlist — guest route protection", () => {
  test("a guest visiting /wishlist directly is redirected to login, never shown a temporary wishlist", async ({
    page,
  }) => {
    await page.context().clearCookies();
    await page.goto("/en/wishlist");
    await expect(page).toHaveURL(/\/login\?next=/);
  });
});
