import { test, expect, type Page } from "./fixtures/base";
import { resetSeededStock } from "./fixtures/catalog-reset";
import { addCardToCart } from "./fixtures/add-to-cart";

/**
 * Guest adds/removes/updates cart quantities and the cart persists across
 * navigation (quickstart Scenario 1, T108). Also covers authenticated
 * cart persistence and the guest→registered merge (spec: Phase 6),
 * exercised end-to-end against a real running server + Firebase Auth
 * emulator, since Server Actions read `cookies()`/session state that
 * can't be driven outside a real request.
 *
 * Requires the Firebase Local Emulator Suite running with
 * `scripts/seed.ts` already applied.
 */

// Add-to-cart itself never decrements stock (only order-creation does,
// T132) — this file only needs the seeded bracelet to have stock > 0 so
// its "Add to Cart" button is enabled, regardless of what another spec
// file already did to this shared product.
test.beforeAll(async () => {
  await resetSeededStock(["golden-bangle-bracelet"]);
});

async function addFirstProductToCart(page: Page) {
  await page.goto("/en/shop/category/bracelets");
  await addCardToCart(page, "Golden Bangle Bracelet");
  // Every test below reads the cart page itself, and the helper only
  // guarantees the cart changed — land there and confirm the line before
  // the caller starts asserting on it.
  await page.goto("/en/cart");
  await expect(page.getByText("Golden Bangle Bracelet")).toBeVisible({ timeout: 15000 });
}

async function registerNewCustomer(page: Page, name: string, emailPrefix: string) {
  let attempt = 0;
  await expect(async () => {
    attempt += 1;
    // A fresh email per attempt: retrying the same registration after a
    // slow-but-successful first attempt would otherwise hit
    // "email already in use" instead of actually re-testing anything.
    await page.goto("/en/register");
    await page.getByLabel("Full Name").fill(name);
    await page.getByLabel("Email").fill(`${emailPrefix}-attempt${attempt}@example.com`);
    await page.getByLabel("Password").fill("supersecret123");
    await page.getByRole("button", { name: "Create Account" }).click();
    await expect(page).toHaveURL(/\/en\/?$/, { timeout: 20000 });
  }).toPass({ timeout: 75000 });
}

test.describe("guest cart", () => {
  test("guest can add an item, see it on the cart page, and it persists across navigation and refresh", async ({
    page,
  }) => {
    await addFirstProductToCart(page);

    await expect(page.getByRole("heading", { name: "Your Cart", level: 1 })).toBeVisible();
    await expect(page.getByText("Golden Bangle Bracelet")).toBeVisible();

    // Persists across navigation.
    await page.goto("/en/shop");
    await page.goto("/en/cart");
    await expect(page.getByText("Golden Bangle Bracelet")).toBeVisible();

    // Persists across a full page refresh.
    await page.reload();
    await expect(page.getByText("Golden Bangle Bracelet")).toBeVisible();
  });

  test("guest can increase and decrease quantity, and the line total updates", async ({ page }) => {
    await addFirstProductToCart(page);

    // The stepper's own value, not "a 2 somewhere on the page".
    const quantity = page.getByLabel("Quantity").locator("span").first();
    await expect(quantity).toHaveText("1");

    // Re-clicks only while the quantity is still 1: `+` fires a Server
    // Action that is not idempotent, so a retry that clicks unconditionally
    // walks the line item up to 3, 5, 8 units and then looks for a "2" that
    // no longer exists.
    const increaseButton = page.getByRole("button", { name: "+" });
    await expect(async () => {
      if ((await quantity.textContent())?.trim() === "1") {
        await increaseButton.click();
        await expect(quantity).toHaveText("2", { timeout: 10000 });
      }
    }).toPass({ timeout: 45000 });
    await expect(quantity).toHaveText("2");
  });

  test("guest can remove an item and the cart becomes empty", async ({ page }) => {
    await addFirstProductToCart(page);

    // Clicking Remove again after it already worked is harmless (the
    // button is gone), so this retry is safe — unlike the quantity
    // stepper's, which had to be guarded.
    await expect(async () => {
      const remove = page.getByRole("button", { name: "Remove" });
      if (await remove.count()) await remove.first().click();
      await expect(page.getByText("Your cart is empty")).toBeVisible({ timeout: 10000 });
    }).toPass({ timeout: 45000 });
  });

  test("a Sold Out product cannot be added to cart", async ({ page }) => {
    await page.goto("/en/shop/pearl-tennis-bracelet");
    // The main purchase panel's button is first in DOM order; a related
    // product further down the page could coincidentally also read
    // "SOLD OUT", so this targets the primary one specifically.
    const addToCartButton = page.getByRole("main").getByRole("button", { name: "SOLD OUT" }).first();
    await expect(addToCartButton).toBeDisabled();
  });

  test("empty cart shows the empty state with a Continue Shopping action", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/en/cart");
    await expect(page.getByText("Your cart is empty")).toBeVisible();
    await expect(page.getByRole("link", { name: "Continue Shopping" })).toBeVisible();
  });

  test("Arabic cart page renders localized labels in RTL", async ({ page }) => {
    await page.context().clearCookies();
    await addFirstProductToCart(page);
    await page.goto("/ar/cart");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "سلتك", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "متابعة التسوق" })).toBeVisible();
  });
});

test.describe("authenticated cart + guest merge", () => {
  test("guest cart merges into the account cart on registration", async ({ page }) => {
    await page.context().clearCookies();
    await addFirstProductToCart(page);

    await registerNewCustomer(page, "Cart Merge Tester", `cart-merge-${Date.now()}`);

    await page.goto("/en/cart");
    await expect(page.getByText("Golden Bangle Bracelet")).toBeVisible();
  });

  test("two different registered customers never see each other's cart", async ({ browser }) => {
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();

    await addFirstProductToCart(pageA);
    await registerNewCustomer(pageA, "Customer A", `cart-iso-a-${Date.now()}`);

    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await registerNewCustomer(pageB, "Customer B", `cart-iso-b-${Date.now()}`);

    await pageB.goto("/en/cart");
    await expect(pageB.getByText("Your cart is empty")).toBeVisible();
    await expect(pageB.getByText("Golden Bangle Bracelet")).toHaveCount(0);

    await contextA.close();
    await contextB.close();
  });
});
