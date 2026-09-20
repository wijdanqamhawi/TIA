import { test, expect } from "./fixtures/base";
import { addDetailToCart } from "./fixtures/add-to-cart";

/**
 * T241 (quickstart Scenarios 1 + 9 combined): the full guest commerce
 * flow — Home -> Shop -> product detail -> Add to Cart -> Cart -> Checkout
 * (Cash on Delivery) -> Order Confirmation — exercised end to end at the
 * desktop viewport, using the visible desktop nav (no hamburger menu) and
 * this file's own dedicated test product.
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

test.describe("desktop commerce flow (English/LTR)", () => {
  let productSlug: string;
  let productName: string;
  let productId: string;

  test.beforeAll(async () => {
    const db = await getTestFirestore();
    const ref = db.collection("products").doc();
    productId = ref.id;
    productName = `E2E Desktop Flow Bracelet ${Date.now()}`;
    productSlug = `e2e-desktop-flow-bracelet-${Date.now()}`;
    const now = new Date();
    await ref.set({
      id: ref.id,
      name: { en: productName, ar: null },
      slug: productSlug,
      description: { en: "A dedicated test product for the desktop commerce flow.", ar: null },
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

  test("guest browses, adds to cart, and completes COD checkout on a desktop viewport", async ({ page }) => {
    // This flow is specific to the desktop layout (its navigation differs by
    // breakpoint), so it sets that viewport itself rather than inheriting
    // whichever device project runs it.
    await page.setViewportSize({ width: 1440, height: 900 });
    // 1. Home.
    await page.goto("/en");
    await expect(page.getByRole("heading", { name: "More than accessories", level: 1 })).toBeVisible();
    expect(await page.evaluate(hasNoHorizontalOverflow)).toBe(true);

    // 2. Reach Shop via the always-visible desktop nav (no hamburger menu).
    // The header's nav specifically: the footer carries its own "Shop" navigation too.
    await page.getByRole("banner").getByRole("navigation").getByRole("link", { name: "Shop", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/shop$/, { timeout: 10000 });
    expect(await page.evaluate(hasNoHorizontalOverflow)).toBe(true);

    // 3. Product detail (direct nav by slug).
    await page.goto(`/en/shop/${productSlug}`);
    await expect(page.getByRole("heading", { name: productName, level: 1 })).toBeVisible();
    expect(await page.evaluate(hasNoHorizontalOverflow)).toBe(true);

    // 4. Add to Cart. Two buttons legitimately render on the product
    // detail page (the desktop purchase panel and the mobile sticky bar,
    // both present in the DOM regardless of viewport) — `.first()`
    // resolves the strict-mode ambiguity.
    await addDetailToCart(page);

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

    await page.getByLabel("Full Name").fill("Desktop Shopper");
    await page.getByLabel("Mobile Phone Number").fill("+970599123456");
    await page.getByLabel("Email").fill(`desktop-flow-${Date.now()}@example.com`);
    await page.getByLabel("Region").selectOption({ label: "West Bank" });
    await expect(async () => {
      const options = await page.getByLabel("City / Area").locator("option").count();
      expect(options).toBeGreaterThan(1);
    }).toPass({ timeout: 30000 });
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
