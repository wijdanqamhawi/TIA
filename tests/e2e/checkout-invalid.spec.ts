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
 * run's environment, and `scripts/seed.ts` already applied.
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

async function setProductStock(slug: string, stock: number) {
  const { FieldValue } = await import("firebase-admin/firestore");
  const db = await getTestFirestore();
  const snapshot = await db.collection("products").where("slug", "==", slug).limit(1).get();
  if (snapshot.empty) throw new Error(`Seed product not found: ${slug}`);
  await snapshot.docs[0].ref.update({ stock, updatedAt: FieldValue.serverTimestamp() });
}

async function getProductStock(slug: string): Promise<number> {
  const db = await getTestFirestore();
  const snapshot = await db.collection("products").where("slug", "==", slug).limit(1).get();
  return snapshot.empty ? -1 : (snapshot.docs[0].data().stock ?? -1);
}

async function addToCartWithQuantity(page: Page, quantity: number) {
  // Each "Add to Cart" click on the detail page adds/merges quantity 1
  // (mirrors `addCartItemAction`'s additive-merge behavior) — clicking it
  // `quantity` times reaches the target total without needing the
  // quantity stepper. Mirrors `addFirstProductToCart` in cart.spec.ts/
  // checkout.spec.ts — critically, `goto` happens once, not inside the
  // retry loop, so a retry only re-clicks rather than paying a full page
  // reload's cost each time.
  await page.goto("/en/shop/golden-bangle-bracelet");
  const addButton = page.getByRole("main").getByRole("button", { name: "Add to Cart" }).first();

  for (let i = 0; i < quantity; i++) {
    await expect(async () => {
      await addButton.click();
      await expect(addButton).toBeEnabled({ timeout: 2000 });
    }).toPass({ timeout: 20000 });
  }

  await expect(async () => {
    await page.goto("/en/cart");
    await expect(page.getByText("Golden Bangle Bracelet")).toBeVisible({ timeout: 2000 });
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
  }).toPass({ timeout: 10000 });
  await page.getByLabel("City / Area").selectOption({ index: 1 });
  await page.getByLabel("Full Address").fill("123 Main Street");
}

test.describe("checkout — stock/Sold Out revalidation at order-creation time", () => {
  // Belt-and-suspenders alongside the existing per-test `afterEach` reset
  // below: guarantees a known starting stock even if an earlier spec file
  // left this product in an unexpected state before this file's first test.
  test.beforeAll(async () => {
    await setProductStock("golden-bangle-bracelet", 12);
  });

  test.afterEach(async () => {
    // Always restore the seeded stock afterward so this test never leaks
    // state into other e2e specs sharing the same emulator/seed data.
    await setProductStock("golden-bangle-bracelet", 12).catch(() => undefined);
  });

  test("stock reduced below the cart quantity after add-to-cart is rejected safely, cart and stock untouched", async ({
    page,
  }) => {
    await page.context().clearCookies();
    await setProductStock("golden-bangle-bracelet", 5);
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
    await setProductStock("golden-bangle-bracelet", 1);

    await page.getByRole("button", { name: "Place Order" }).click();

    await expect(page).toHaveURL(/\/checkout/); // no redirect to a confirmation page
    await expect(page.getByRole("alert")).toBeVisible();

    expect(await getProductStock("golden-bangle-bracelet")).toBe(1); // untouched, not decremented

    await page.goto("/en/cart");
    await expect(page.getByText("Golden Bangle Bracelet")).toBeVisible(); // cart line still present
  });

  test("stock reduced to 0 (Sold Out) after add-to-cart is rejected, and the cart page reflects Sold Out on next view", async ({
    page,
  }) => {
    await page.context().clearCookies();
    await setProductStock("golden-bangle-bracelet", 5);
    await addToCartWithQuantity(page, 1);

    await goToCheckoutAndFillForm(page);
    await setProductStock("golden-bangle-bracelet", 0);
    await page.getByRole("button", { name: "Place Order" }).click();

    await expect(page).toHaveURL(/\/checkout/);
    await expect(page.getByRole("alert")).toBeVisible();

    await page.goto("/en/cart");
    await expect(page.getByText("sold out", { exact: false })).toBeVisible();
  });
});
