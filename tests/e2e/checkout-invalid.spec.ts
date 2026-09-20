import { test, expect, type Page } from "./fixtures/base";

/**
 * Checkout-time stock/Sold-Out revalidation (T132, quickstart Scenario 8):
 * proves the order-creation transaction re-reads authoritative Firestore
 * stock at the moment of checkout, not whatever the cart last displayed.
 *
 * Simulates "an admin reduces stock while it sits in the customer's
 * cart" by writing directly to Firestore via the Admin SDK from the test
 * itself (Phase 10's admin product-management UI doesn't exist yet to
 * drive this through the browser) — requires the Firebase Local Emulator
 * Suite running with `FIRESTORE_EMULATOR_HOST` set in this Playwright
 * run's environment, and `scripts/seed.ts` already applied (the delivery
 * regions the checkout form needs).
 */

// Talks to the Admin SDK directly (never `@/lib/firebase/firestore`, which
// is tagged `import "server-only"` — Next.js aliases that away at webpack
// build time for the app itself, but Playwright's own Node runtime has no
// such alias, so importing it here would throw).
async function getTestFirestore() {
  const { getApps, initializeApp } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  const app = getApps()[0] ?? initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID ?? "demo-elora" });
  return getFirestore(app);
}

/**
 * This file's own product — never a seeded one.
 *
 * Proving checkout-time revalidation *requires* dropping a product's stock
 * to 1 and to 0 mid-test. On a seeded product that is shared state: the
 * emulator/Firestore data is common to the whole run, so with more than one
 * Playwright worker those writes land while `cart`, `checkout`,
 * `checkout-ar`, `account-orders`, `browse`, `wishlist` … are adding the
 * very same product to a cart, and they fail on a genuinely Sold Out
 * button that this file made Sold Out. A dedicated, uniquely-named product
 * (as `concurrent-checkout.spec.ts` and `special-offers.spec.ts` already
 * use) keeps the scenario identical and the blast radius zero.
 */
const product = {
  id: "",
  name: "",
  slug: "",
  /** Ample starting stock, so only this file's deliberate reductions matter. */
  stock: 12,
};

async function createTestProduct() {
  const db = await getTestFirestore();
  const ref = db.collection("products").doc();
  const stamp = Date.now();
  product.id = ref.id;
  product.name = `E2E Stock Revalidation ${stamp}`;
  product.slug = `e2e-stock-revalidation-${stamp}`;
  const now = new Date();
  await ref.set({
    id: ref.id,
    name: { en: product.name, ar: null },
    slug: product.slug,
    description: { en: "A dedicated stock-revalidation test product.", ar: null },
    price: 4500,
    categoryId: "bracelets",
    images: [],
    material: { en: "Test Material", ar: null },
    options: [],
    stock: product.stock,
    availability: true,
    isNewArrival: false,
    isBestSeller: false,
    salesCount: 0,
    searchTerms: [],
    isOnSale: false,
    salePrice: null,
    saleStartAt: null,
    saleEndAt: null,
    createdAt: now,
    updatedAt: now,
  });
}

async function setProductStock(stock: number) {
  const { FieldValue } = await import("firebase-admin/firestore");
  const db = await getTestFirestore();
  await db.collection("products").doc(product.id).update({ stock, updatedAt: FieldValue.serverTimestamp() });
}

async function getProductStock(): Promise<number> {
  const db = await getTestFirestore();
  const snapshot = await db.collection("products").doc(product.id).get();
  return snapshot.exists ? (snapshot.data()!.stock ?? -1) : -1;
}

async function addToCartWithQuantity(page: Page, quantity: number) {
  // Each "Add to Cart" click on the detail page adds/merges quantity 1
  // (mirrors `addCartItemAction`'s additive-merge behavior) — clicking it
  // `quantity` times reaches the target total without needing the
  // quantity stepper. Mirrors `addFirstProductToCart` in cart.spec.ts/
  // checkout.spec.ts — critically, `goto` happens once, not inside the
  // retry loop, so a retry only re-clicks rather than paying a full page
  // reload's cost each time.
  await page.goto(`/en/shop/${product.slug}`);
  const addButton = page.getByRole("main").getByRole("button", { name: "Add to Cart" }).first();

  for (let i = 0; i < quantity; i++) {
    await expect(async () => {
      await addButton.click();
      await expect(addButton).toBeEnabled({ timeout: 2000 });
    }).toPass({ timeout: 20000 });
  }

  await expect(async () => {
    await page.goto("/en/cart");
    await expect(page.getByText(product.name)).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20000 });
}

async function goToCheckoutAndFillForm(page: Page) {
  await page.goto("/en/checkout");
  await page.getByLabel("Full Name").fill("Jane Shopper");
  await page.getByLabel("Mobile Phone Number").fill("+970599123456");
  await page.getByLabel("Email").fill(`checkout-invalid-${Date.now()}@example.com`);
  await page.getByLabel("Region").selectOption({ label: "West Bank" });
  await expect(async () => {
    const options = await page.getByLabel("City / Area").locator("option").count();
    expect(options).toBeGreaterThan(1);
  }).toPass({ timeout: 30000 });
  await page.getByLabel("City / Area").selectOption({ index: 1 });
  await page.getByLabel("Full Address").fill("123 Main Street");
}

test.describe("checkout — stock/Sold Out revalidation at order-creation time", () => {
  test.beforeAll(createTestProduct);

  test.afterAll(async () => {
    const db = await getTestFirestore();
    await db.collection("products").doc(product.id).delete();
  });

  test.afterEach(async () => {
    // Back to the known starting stock, so each test in this file starts
    // from the same state regardless of what the previous one reduced it to.
    await setProductStock(product.stock).catch(() => undefined);
  });

  test("stock reduced below the cart quantity after add-to-cart is rejected safely, cart and stock untouched", async ({
    page,
  }) => {
    await page.context().clearCookies();
    await setProductStock(5);
    await addToCartWithQuantity(page, 2);

    // Reach the checkout page (and fill the form) while stock is still
    // sufficient — this task's checkout page itself already redirects an
    // over-quantity cart straight back to `/cart` on page load, so the
    // race this test targets (stock changing *after* the shopper is
    // already filling the form) must simulate the admin's stock reduction
    // only once she's past that initial page-load check, exactly like a
    // real concurrent edit would.
    await goToCheckoutAndFillForm(page);

    // Simulate an admin reducing stock to below the cart's quantity while
    // she is filling out the form.
    await setProductStock(1);

    await page.getByRole("button", { name: "Place Order" }).click();

    await expect(page).toHaveURL(/\/checkout/); // no redirect to a confirmation page
    await expect(page.getByRole("alert")).toBeVisible();

    expect(await getProductStock()).toBe(1); // untouched, not decremented

    await page.goto("/en/cart");
    await expect(page.getByText(product.name)).toBeVisible(); // cart line still present
  });

  test("stock reduced to 0 (Sold Out) after add-to-cart is rejected, and the cart page reflects Sold Out on next view", async ({
    page,
  }) => {
    await page.context().clearCookies();
    await setProductStock(5);
    await addToCartWithQuantity(page, 1);

    await goToCheckoutAndFillForm(page);
    await setProductStock(0);
    await page.getByRole("button", { name: "Place Order" }).click();

    await expect(page).toHaveURL(/\/checkout/);
    await expect(page.getByRole("alert")).toBeVisible();

    await page.goto("/en/cart");
    await expect(page.getByText("sold out", { exact: false })).toBeVisible();
  });
});
