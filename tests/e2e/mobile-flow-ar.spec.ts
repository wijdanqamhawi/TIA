import { test, expect } from "./fixtures/base";
import { addDetailToCart } from "./fixtures/add-to-cart";

/**
 * T240 (quickstart Scenario 13 step 12, combined with Scenarios 1 + 9):
 * the full guest commerce flow — Home -> Shop/category -> product detail
 * -> Add to Cart -> Cart -> Checkout (Cash on Delivery) -> Order
 * Confirmation — exercised end to end in Arabic/RTL at the mobile
 * viewport, using this file's own dedicated test product so it never
 * competes with any other spec file's stock.
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

test.describe("mobile commerce flow (Arabic/RTL)", () => {
  let productSlug: string;
  let productNameAr: string;
  let productId: string;

  test.beforeAll(async () => {
    const db = await getTestFirestore();
    const ref = db.collection("products").doc();
    productId = ref.id;
    productNameAr = `سوار اختبار الجوال ${Date.now()}`;
    productSlug = `e2e-mobile-flow-ar-bracelet-${Date.now()}`;
    const now = new Date();
    await ref.set({
      id: ref.id,
      name: { en: `E2E Mobile Flow AR Bracelet ${Date.now()}`, ar: productNameAr },
      slug: productSlug,
      description: { en: "A dedicated test product.", ar: "منتج اختبار مخصص." },
      price: 12000,
      categoryId: "bracelets",
      images: [],
      material: { en: "Test Material", ar: "مادة اختبار" },
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

  test("guest browses, adds to cart, and completes COD checkout on a mobile viewport, in Arabic", async ({
    page,
  }) => {
    // This flow is specific to the mobile layout (its navigation differs by
    // breakpoint), so it sets that viewport itself rather than inheriting
    // whichever device project runs it.
    await page.setViewportSize({ width: 390, height: 844 });
    // 1. Home.
    await page.goto("/ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "أكثر من مجرد إكسسوارات", level: 1 })).toBeVisible();
    expect(await page.evaluate(hasNoHorizontalOverflow)).toBe(true);

    // 2. Reach Shop via the bottom tab bar — the primary mobile Shop entry.
    //    The hamburger stays available (asserted visible) for categories
    //    and secondary links, but no longer repeats the tab bar's
    //    destinations, so there is exactly one visible Shop control.
    const openMenu = page.getByRole("button", { name: "فتح القائمة" });
    await expect(openMenu).toBeVisible();
    // Two navigations carry a Shop link at this width (the bottom tab bar
    // and the menu drawer's own nav) — the tab bar's comes first, and is the
    // primary mobile Shop entry this flow exercises (mirrors mobile-flow.spec.ts).
    const shopLink = page.getByRole("navigation").getByRole("link", { name: "المتجر", exact: true }).first();
    await expect(shopLink).toBeVisible();
    await shopLink.click();
    await expect(page).toHaveURL(/\/ar\/shop$/, { timeout: 10000 });
    expect(await page.evaluate(hasNoHorizontalOverflow)).toBe(true);

    // 3. Product detail (direct nav by slug).
    await page.goto(`/ar/shop/${productSlug}`);
    await expect(page.getByRole("heading", { name: productNameAr, level: 1 })).toBeVisible();
    expect(await page.evaluate(hasNoHorizontalOverflow)).toBe(true);

    // 4. Add to Cart.
    // Two buttons legitimately render on the product detail page (the
    // desktop purchase panel and the mobile sticky bar, both present in
    // the DOM regardless of viewport) — `.first()` resolves the
    // strict-mode ambiguity.
    await addDetailToCart(page);

    // 5. Cart.
    await expect(async () => {
      await page.goto("/ar/cart");
      await expect(page.getByText(productNameAr)).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15000 });
    expect(await page.evaluate(hasNoHorizontalOverflow)).toBe(true);

    // 6. Checkout.
    await page.getByRole("link", { name: "المتابعة إلى الدفع" }).click();
    await expect(page).toHaveURL(/\/checkout/, { timeout: 15000 });
    expect(await page.evaluate(hasNoHorizontalOverflow)).toBe(true);

    await page.getByLabel("الاسم الكامل").fill("متسوقة الجوال");
    await page.getByLabel("رقم الهاتف المحمول").fill("+970599123456");
    await page.getByLabel("البريد الإلكتروني").fill(`mobile-flow-ar-${Date.now()}@example.com`);
    await page.getByLabel("المنطقة").selectOption({ label: "الضفة الغربية" });
    await expect(async () => {
      const options = await page.getByLabel("المدينة / الحي").locator("option").count();
      expect(options).toBeGreaterThan(1);
    }).toPass({ timeout: 30000 });
    await page.getByLabel("المدينة / الحي").selectOption({ index: 1 });
    await page.getByLabel("العنوان الكامل").fill("شارع تجريبي ١");

    await expect(async () => {
      await page.getByRole("button", { name: "إتمام الطلب" }).click();
      await expect(page).toHaveURL(/\/order-confirmation\/ELR-\d{8}-\d{4}/, { timeout: 15000 });
    }).toPass({ timeout: 30000 });

    // 7. Order Confirmation.
    await expect(page.getByRole("heading", { name: "تم تأكيد الطلب" })).toBeVisible();
    await expect(page.getByText(productNameAr)).toBeVisible();
    await expect(page.getByText("الدفع عند الاستلام")).toBeVisible();
    expect(await page.evaluate(hasNoHorizontalOverflow)).toBe(true);
  });
});
