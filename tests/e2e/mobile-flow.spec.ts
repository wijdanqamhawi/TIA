import { test, expect } from "./fixtures/base";

/**
 * T239 (quickstart Scenarios 1 + 9 combined): the full guest commerce
 * flow — Home -> Shop/category -> product detail -> Add to Cart -> Cart
 * -> Checkout (Cash on Delivery) -> Order Confirmation — exercised end to
 * end at the mobile viewport (this file's own dedicated test product, so
 * it never competes with any other spec file's stock).
 *
 * Requires the Firebase Local Emulator Suite running with
 * `scripts/seed.ts` already applied.
 */

async function getTestFirestore() {
  const { getApps, initializeApp } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  const app = getApps()[0] ?? initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID ?? "demo-elora" });
  return getFirestore(app);
}

function hasNoHorizontalOverflow(): Promise<boolean> {
  return Promise.resolve(document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
}

test.describe("mobile commerce flow (English/LTR)", () => {
  let productSlug: string;
  let productName: string;
  let productId: string;

  test.beforeAll(async () => {
    const db = await getTestFirestore();
    const ref = db.collection("products").doc();
    productId = ref.id;
    productName = `E2E Mobile Flow Bracelet ${Date.now()}`;
    productSlug = `e2e-mobile-flow-bracelet-${Date.now()}`;
    const now = new Date();
    await ref.set({
      id: ref.id,
      name: { en: productName, ar: null },
      slug: productSlug,
      description: { en: "A dedicated test product for the mobile commerce flow.", ar: null },
      price: 12000,
      categoryId: "bracelets",
      images: [],
      material: { en: "Test Material", ar: null },
      options: [],
      stock: 5,
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
  });

  test.afterAll(async () => {
    const db = await getTestFirestore();
    await db.collection("products").doc(productId).delete();
  });

  test("guest browses, adds to cart, and completes COD checkout on a mobile viewport", async ({ page }) => {
    // 1. Home
    await page.goto("/en");
    await expect(page.getByRole("heading", { name: "ELORA JEWELLERY" })).toBeVisible();
    expect(await page.evaluate(hasNoHorizontalOverflow)).toBe(true);

    // 2. Reach Shop via the mobile hamburger menu (proves mobile nav works).
    // Retries the whole open->click sequence: on a slower engine, a click
    // landing before client-side hydration completes hits inert
    // server-rendered markup with no event handlers attached yet (same
    // idiom used in browse.spec.ts).
    const openMenu = page.getByRole("button", { name: "Open menu" });
    await expect(openMenu).toBeVisible();
    await openMenu.click();
    const shopLink = page.getByRole("navigation").getByRole("link", { name: "Shop", exact: true });
    await expect(shopLink).toBeVisible();
    await shopLink.click();
    await expect(page).toHaveURL(/\/en\/shop$/, { timeout: 10000 });
    expect(await page.evaluate(hasNoHorizontalOverflow)).toBe(true);

    // 3. Product detail (direct nav by slug — the grid may paginate and
    // this product is deliberately new/unfeatured).
    await page.goto(`/en/shop/${productSlug}`);
    await expect(page.getByRole("heading", { name: productName, level: 1 })).toBeVisible();
    expect(await page.evaluate(hasNoHorizontalOverflow)).toBe(true);

    // 4. Add to Cart. A single click, then wait out the Server Action's
    // pending state — retry-wrapping click+assert here (as the category
    // grid's `.first()` pattern does elsewhere) would re-click on every
    // retry and pile up multiple real cart mutations against this
    // product's single line item.
    // Two buttons legitimately render on the product detail page (the
    // desktop purchase panel and the mobile sticky bar, both present in
    // the DOM regardless of viewport) — `.first()` resolves the
    // strict-mode ambiguity.
    const addToCartButton = page.getByRole("main").getByRole("button", { name: "Add to Cart" }).first();
    await expect(addToCartButton).toBeEnabled({ timeout: 15000 });
    await addToCartButton.click();
    await expect(addToCartButton).toBeEnabled({ timeout: 15000 });

    // 5. Cart.
    await expect(async () => {
      await page.goto("/en/cart");
      await expect(page.getByText(productName)).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15000 });
    expect(await page.evaluate(hasNoHorizontalOverflow)).toBe(true);

    // 6. Checkout.
    await page.getByRole("link", { name: "Proceed to Checkout" }).click();
    await expect(page).toHaveURL(/\/checkout/, { timeout: 15000 });
    expect(await page.evaluate(hasNoHorizontalOverflow)).toBe(true);

    await page.getByLabel("Full Name").fill("Mobile Shopper");
    await page.getByLabel("Mobile Phone Number").fill("+970599123456");
    await page.getByLabel("Email").fill(`mobile-flow-${Date.now()}@example.com`);
    await page.getByLabel("Region").selectOption({ label: "West Bank" });
    await expect(async () => {
      const options = await page.getByLabel("City / Area").locator("option").count();
      expect(options).toBeGreaterThan(1);
    }).toPass({ timeout: 10000 });
    await page.getByLabel("City / Area").selectOption({ index: 1 });
    await page.getByLabel("Full Address").fill("1 Test Street");

    await expect(async () => {
      await page.getByRole("button", { name: "Place Order" }).click();
      await expect(page).toHaveURL(/\/order-confirmation\/ELR-\d{8}-\d{4}/, { timeout: 15000 });
    }).toPass({ timeout: 30000 });

    // 7. Order Confirmation.
    await expect(page.getByRole("heading", { name: "Order Confirmed" })).toBeVisible();
    await expect(page.getByText(productName)).toBeVisible();
    await expect(page.getByText("Cash on Delivery")).toBeVisible();
    expect(await page.evaluate(hasNoHorizontalOverflow)).toBe(true);
  });
});
