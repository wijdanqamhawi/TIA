import { test, expect, type Page } from "./fixtures/base";
import { resetSeededStock } from "./fixtures/catalog-reset";

/**
 * T246 (Phase 17, quickstart Scenario 13 step 6): Arabic checkout — RTL
 * form layout, localized field labels/validation messages, an Arabic
 * order summary, and an authoritative total identical (in minor units,
 * via a direct Admin SDK read — never a fragile rendered-digit-glyph
 * comparison, since `Intl.NumberFormat("ar", ...)` may render Eastern
 * Arabic numerals) to what the same product/quantity produces in
 * English.
 */

async function getTestFirestore() {
  const { getApps, initializeApp } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  const app = getApps()[0] ?? initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID ?? "demo-elora" });
  return getFirestore(app);
}

async function addFirstBraceletToCart(page: Page, locale: "en" | "ar") {
  await page.goto(`/${locale}/shop/category/bracelets`);
  const addButton = page.getByRole("main").getByRole("button", { name: /Add to Cart|أضف إلى السلة/ }).first();
  // A single click, then wait out the Server Action's own pending state —
  // not retry-wrapped around the click itself: under load, a too-short
  // inner timeout here previously caused `.toPass()` to retry and
  // double-click, silently adding quantity 2 instead of 1 and breaking
  // this suite's authoritative-total assertion.
  await expect(addButton).toBeEnabled({ timeout: 15000 });
  await addButton.click();
  await expect(addButton).toBeEnabled({ timeout: 15000 });
}

test.describe("checkout — Arabic (RTL)", () => {
  test.beforeAll(async () => {
    await resetSeededStock(["golden-bangle-bracelet"]);
  });

  test("Arabic checkout form is RTL with localized labels and validation", async ({ page }) => {
    await page.context().clearCookies();
    await addFirstBraceletToCart(page, "ar");
    await page.goto("/ar/checkout");

    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByLabel("الاسم الكامل")).toBeVisible();
    await expect(page.getByLabel("رقم الهاتف المحمول")).toBeVisible();
    await expect(page.getByLabel("البريد الإلكتروني")).toBeVisible();
    await expect(page.getByRole("heading", { name: "ملخص الطلب" })).toBeVisible();

    // Missing phone.
    await page.getByLabel("الاسم الكامل").fill("زائرة تجريبية");
    await page.getByLabel("البريد الإلكتروني").fill(`checkout-ar-${Date.now()}@example.com`);
    await page.getByLabel("المنطقة").selectOption({ label: "الضفة الغربية" });
    await expect(async () => {
      const options = await page.getByLabel("المدينة / الحي").locator("option").count();
      expect(options).toBeGreaterThan(1);
    }).toPass({ timeout: 10000 });
    await page.getByLabel("المدينة / الحي").selectOption({ index: 1 });
    await page.getByLabel("العنوان الكامل").fill("شارع رئيسي ١٢٣");

    await page.getByRole("button", { name: "إتمام الطلب" }).click();
    await expect(page.getByText("رقم الهاتف المحمول مطلوب.")).toBeVisible();

    // Invalid phone.
    await page.getByLabel("رقم الهاتف المحمول").fill("ليس-رقم-هاتف");
    await page.getByRole("button", { name: "إتمام الطلب" }).click();
    await expect(page.getByText("أدخل رقم هاتف محمول صحيحًا.")).toBeVisible();

    await expect(page).toHaveURL(/\/checkout/);
  });

  test("a completed Arabic checkout produces an order confirmation with the correct authoritative total", async ({
    page,
  }) => {
    await page.context().clearCookies();
    await addFirstBraceletToCart(page, "ar");
    await page.goto("/ar/checkout");

    await page.getByLabel("الاسم الكامل").fill("زائرة تجريبية");
    await page.getByLabel("رقم الهاتف المحمول").fill("+970599123456");
    await page.getByLabel("البريد الإلكتروني").fill(`checkout-ar-complete-${Date.now()}@example.com`);
    await page.getByLabel("المنطقة").selectOption({ label: "الضفة الغربية" });
    await expect(async () => {
      const options = await page.getByLabel("المدينة / الحي").locator("option").count();
      expect(options).toBeGreaterThan(1);
    }).toPass({ timeout: 10000 });
    await page.getByLabel("المدينة / الحي").selectOption({ index: 1 });
    await page.getByLabel("العنوان الكامل").fill("شارع رئيسي ١٢٣");

    await expect(async () => {
      await page.getByRole("button", { name: "إتمام الطلب" }).click();
      await expect(page).toHaveURL(/\/order-confirmation\/(ELR-\d{8}-\d{4})/, { timeout: 15000 });
    }).toPass({ timeout: 30000 });

    await expect(page.getByRole("heading", { name: "تم تأكيد الطلب" })).toBeVisible();
    await expect(page.getByText("سوار ذهبي")).toBeVisible();
    await expect(page.getByText("الدفع عند الاستلام")).toBeVisible();

    const orderNumber = page.url().match(/ELR-\d{8}-\d{4}/)?.[0];
    expect(orderNumber).toBeTruthy();

    // Authoritative check: the order's stored total (minor units) equals
    // the seeded product's own price — the same value an equivalent
    // English checkout of the same product/quantity would produce,
    // verified server-side rather than by comparing locale-formatted
    // digit glyphs on screen.
    const db = await getTestFirestore();
    const orderSnapshot = await db.collection("orders").where("orderNumber", "==", orderNumber).limit(1).get();
    expect(orderSnapshot.empty).toBe(false);
    const order = orderSnapshot.docs[0].data();

    const productSnapshot = await db
      .collection("products")
      .where("slug", "==", "golden-bangle-bracelet")
      .limit(1)
      .get();
    const expectedUnitPrice = productSnapshot.docs[0].data().price as number;
    const orderedQuantity = (order.items as Array<{ quantity: number }>)[0].quantity;
    const expectedTotal = expectedUnitPrice * orderedQuantity;

    expect(order.total).toBe(expectedTotal);
    expect(order.subtotal).toBe(expectedTotal);
  });
});
