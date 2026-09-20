import { test, expect, type Page } from "./fixtures/base";
import { resetSeededStock } from "./fixtures/catalog-reset";
import { addCardToCart } from "./fixtures/add-to-cart";

/**
 * Guest and registered checkout end-to-end coverage (T131, quickstart
 * Scenario 1): completes Cash on Delivery checkout and confirms a
 * correct, bilingual-capable order confirmation page.
 *
 * Requires the Firebase Local Emulator Suite running with
 * `scripts/seed.ts` already applied (seeds `west-bank`/`inside-1948`
 * delivery regions/locations and the `Golden Bangle Bracelet` product).
 */

async function addFirstProductToCart(page: Page) {
  // The Golden Bangle Bracelet card specifically: a no-options product adds
  // directly from its card, while the with-options Aurelia Signature Cuff in
  // the same grid opens Quick View instead (see fixtures/product-card.ts).
  await page.goto("/en/shop/category/bracelets");
  await addCardToCart(page, "Golden Bangle Bracelet");
}

async function fillCheckoutForm(page: Page, overrides: Partial<Record<string, string>> = {}) {
  await page.getByLabel("Full Name").fill(overrides.fullName ?? "Jane Shopper");
  await page.getByLabel("Mobile Phone Number").fill(overrides.phone ?? "+970 599 123 456");
  await page.getByLabel("Email").fill(overrides.email ?? `checkout-${Date.now()}@example.com`);

  await page.getByLabel("Region").selectOption({ label: "West Bank" });
  // Cities populate asynchronously after the region is chosen.
  await expect(async () => {
    const options = await page.getByLabel("City / Area").locator("option").count();
    expect(options).toBeGreaterThan(1);
  }).toPass({ timeout: 30000 });
  await page.getByLabel("City / Area").selectOption({ index: 1 });

  await page.getByLabel("Full Address").fill(overrides.fullAddress ?? "123 Main Street, Apartment 4");
}

test.describe("checkout — Cash on Delivery", () => {
  // This spec places several real orders (decrementing seeded stock,
  // T132's real behavior) — reset first so it never depends on, or leaks
  // into, whatever another spec file already did to this shared product.
  test.beforeAll(async () => {
    await resetSeededStock(["golden-bangle-bracelet"]);
  });

  test("guest completes COD checkout and sees a correct order confirmation", async ({ page }) => {
    await page.context().clearCookies();
    await addFirstProductToCart(page);

    await page.goto("/en/cart");
    await page.getByRole("link", { name: "Proceed to Checkout" }).click();
    // A generous timeout: dev mode compiles /checkout on-demand on its
    // first visit, which can take several seconds — a production build
    // has no such cold-start cost.
    await expect(page).toHaveURL(/\/checkout/, { timeout: 15000 });

    await fillCheckoutForm(page);

    await expect(async () => {
      await page.getByRole("button", { name: "Place Order" }).click();
      await expect(page).toHaveURL(/\/order-confirmation\/ELR-\d{8}-\d{4}/, { timeout: 15000 });
    }).toPass({ timeout: 30000 });

    await expect(page.getByRole("heading", { name: "Order Confirmed" })).toBeVisible();
    await expect(page.getByText("Golden Bangle Bracelet")).toBeVisible();
    await expect(page.getByText("Cash on Delivery")).toBeVisible();
    // Scoped to `main` — the Navbar's own location-selector dialog (T273)
    // also lists "West Bank" as a region heading, always in the DOM (just
    // not displayed while closed) on every storefront page.
    await expect(page.getByRole("main").getByText("West Bank")).toBeVisible();

    // The cart is cleared after a successful order.
    await page.goto("/en/cart");
    await expect(page.getByText("Your cart is empty")).toBeVisible();
  });

  test("checkout requires a mobile phone number and rejects an invalid one", async ({ page }) => {
    await page.context().clearCookies();
    await addFirstProductToCart(page);
    await page.goto("/en/checkout");

    await page.getByLabel("Full Name").fill("Jane Shopper");
    await page.getByLabel("Email").fill(`checkout-phone-${Date.now()}@example.com`);
    await page.getByLabel("Region").selectOption({ label: "West Bank" });
    await expect(async () => {
      const options = await page.getByLabel("City / Area").locator("option").count();
      expect(options).toBeGreaterThan(1);
    }).toPass({ timeout: 30000 });
    await page.getByLabel("City / Area").selectOption({ index: 1 });
    await page.getByLabel("Full Address").fill("123 Main Street");

    // Empty phone. Scoped past Next.js's own route-announcer element (also
    // `role="alert"`) to this form's specific error message.
    await page.getByRole("button", { name: "Place Order" }).click();
    await expect(page.getByText("Mobile phone number is required.")).toBeVisible();

    // Invalid phone (letters).
    await page.getByLabel("Mobile Phone Number").fill("not-a-phone");
    await page.getByRole("button", { name: "Place Order" }).click();
    await expect(page.getByText("valid mobile phone number", { exact: false })).toBeVisible();

    // No order/navigation should have happened.
    await expect(page).toHaveURL(/\/checkout/);
  });

  test("an empty cart cannot reach checkout", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/en/checkout");
    await expect(page).toHaveURL(/\/shop/);
  });

  test("registered customer can complete checkout with prefilled contact info", async ({ page }) => {
    const email = `checkout-registered-${Date.now()}@example.com`;
    await page.goto("/en/register");
    await page.getByLabel("Full Name").fill("Registered Shopper");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("supersecret123");
    await page.getByRole("button", { name: "Create Account" }).click();
    await expect(page).not.toHaveURL(/\/register/, { timeout: 15000 });

    await addFirstProductToCart(page);
    await page.goto("/en/checkout");

    // Full name/email are prefilled from the account profile.
    await expect(page.getByLabel("Full Name")).toHaveValue("Registered Shopper");
    await expect(page.getByLabel("Email")).toHaveValue(email);

    await page.getByLabel("Mobile Phone Number").fill("+970599123456");
    await page.getByLabel("Region").selectOption({ label: "Inside / 1948 Areas" });
    await expect(async () => {
      const options = await page.getByLabel("City / Area").locator("option").count();
      expect(options).toBeGreaterThan(1);
    }).toPass({ timeout: 30000 });
    await page.getByLabel("City / Area").selectOption({ index: 1 });
    await page.getByLabel("Full Address").fill("456 Another Street");

    await expect(async () => {
      await page.getByRole("button", { name: "Place Order" }).click();
      await expect(page).toHaveURL(/\/order-confirmation\/ELR-\d{8}-\d{4}/, { timeout: 15000 });
    }).toPass({ timeout: 30000 });

    await expect(page.getByRole("heading", { name: "Order Confirmed" })).toBeVisible();
  });

  test("Arabic order confirmation renders localized labels in RTL", async ({ page }) => {
    await page.context().clearCookies();
    await addFirstProductToCart(page);
    await page.goto("/en/checkout");
    await fillCheckoutForm(page, { email: `checkout-ar-${Date.now()}@example.com` });

    await expect(async () => {
      await page.getByRole("button", { name: "Place Order" }).click();
      await expect(page).toHaveURL(/\/order-confirmation\/(ELR-\d{8}-\d{4})/, { timeout: 15000 });
    }).toPass({ timeout: 30000 });

    const orderNumber = page.url().match(/ELR-\d{8}-\d{4}/)?.[0];
    expect(orderNumber).toBeTruthy();

    await page.goto(`/ar/order-confirmation/${orderNumber}`);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "تم تأكيد الطلب" })).toBeVisible();
  });
});
