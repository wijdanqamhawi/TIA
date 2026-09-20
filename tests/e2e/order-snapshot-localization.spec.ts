import { test, expect, type Page } from "./fixtures/base";
import { addDetailToCart } from "./fixtures/add-to-cart";
import { loginAsAdmin } from "./admin-helpers";

/**
 * T247 (Phase 17, quickstart Scenario 13 steps 7-8): a placed order's
 * `OrderItem.productName` snapshot stays exactly as it was at order time
 * even after the product's live bilingual name is later edited — proving
 * it is a true point-in-time snapshot, never a live join — and an order's
 * status label localizes correctly in both languages while the
 * underlying stored `status` value is untouched (a raw enum string, not
 * itself translated).
 */

async function getTestFirestore() {
  const { getApps, initializeApp } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  const app = getApps()[0] ?? initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID ?? "demo-elora" });
  return getFirestore(app);
}

/**
 * This file's own product — never a seeded one.
 *
 * The scenario *is* a rename: the product's live bilingual name (and, with
 * it, its slug, which `updateProductAction` re-derives from the English
 * name) changes after the order exists. On a seeded product that rename is
 * shared state — for the seconds it is in effect, every other spec file
 * running in parallel against the same emulator sees the seeded product
 * under a different name and URL (`seo-localization` asserts the sitemap
 * still lists `/shop/golden-bangle-bracelet`; `cart`, `checkout`, `browse`,
 * `wishlist` … look it up by its seeded name). A dedicated, uniquely-named
 * product keeps the scenario exactly as specified with no blast radius.
 */
const product = {
  id: "",
  nameEn: "",
  nameAr: "",
  slug: "",
};

async function createTestProduct() {
  const db = await getTestFirestore();
  const ref = db.collection("products").doc();
  const stamp = Date.now();
  product.id = ref.id;
  product.nameEn = `E2E Snapshot Bracelet ${stamp}`;
  product.nameAr = `سوار لقطة ${stamp}`;
  product.slug = `e2e-snapshot-bracelet-${stamp}`;
  const now = new Date();
  await ref.set({
    id: ref.id,
    name: { en: product.nameEn, ar: product.nameAr },
    slug: product.slug,
    description: { en: "A dedicated order-snapshot test product.", ar: "منتج اختبار." },
    price: 4500,
    categoryId: "bracelets",
    images: [],
    material: { en: "Test Material", ar: "مادة اختبار" },
    options: [],
    stock: 12,
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

async function addTestProductToCart(page: Page) {
  await page.goto(`/en/shop/${product.slug}`);
  // A single click, then wait out the Server Action's own pending state —
  // not retry-wrapped around the click itself: under load, a too-short
  // inner timeout previously caused a retry to re-click and silently add
  // quantity >1, corrupting this test's assumption of a single unit.
  await addDetailToCart(page);
}

test.describe("order snapshot localization survives a later product edit", () => {
  test.beforeAll(createTestProduct);

  test.afterAll(async () => {
    const db = await getTestFirestore();
    await db.collection("products").doc(product.id).delete();
  });

  test("historical order snapshot and status label stay correct after a product-translation edit", async ({
    page,
    browser,
  }) => {
    const email = `order-snapshot-${Date.now()}@example.com`;

    // Register and place a real order as a customer, in her own session.
    await page.goto("/en/register");
    await page.getByLabel("Full Name").fill("Snapshot Tester");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("supersecret123");
    await page.getByRole("button", { name: "Create Account" }).click();
    await expect(page).not.toHaveURL(/\/register/, { timeout: 15000 });

    await addTestProductToCart(page);
    await page.goto("/en/checkout");
    await page.getByLabel("Mobile Phone Number").fill("+970599123456");
    await page.getByLabel("Region").selectOption({ label: "West Bank" });
    await expect(async () => {
      const options = await page.getByLabel("City / Area").locator("option").count();
      expect(options).toBeGreaterThan(1);
    }).toPass({ timeout: 30000 });
    await page.getByLabel("City / Area").selectOption({ index: 1 });
    await page.getByLabel("Full Address").fill("123 Main Street");

    await expect(async () => {
      await page.getByRole("button", { name: "Place Order" }).click();
      await expect(page).toHaveURL(/\/order-confirmation\/(ELR-\d{8}-\d{4})/, { timeout: 15000 });
    }).toPass({ timeout: 30000 });

    const orderNumber = page.url().match(/ELR-\d{8}-\d{4}/)?.[0];
    expect(orderNumber).toBeTruthy();

    await expect(page.getByText(product.nameEn)).toBeVisible();
    await expect(page.getByText("Pending", { exact: true })).toBeVisible();

    // Confirm the stored `status` is the raw enum value, not a translated string.
    const db = await getTestFirestore();
    const orderSnapshot = await db.collection("orders").where("orderNumber", "==", orderNumber).limit(1).get();
    expect(orderSnapshot.docs[0].data().status).toBe("PENDING");

    // Now edit the product as admin — a separate browser context so the
    // customer's own session/cookies are untouched.
    const editedEn = `${product.nameEn} EDITED`;
    const editedAr = `${product.nameAr} معدّل`;
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await loginAsAdmin(adminPage);
    await adminPage.goto(`/admin/products/${product.id}/edit`);
    await adminPage.getByLabel("Name — English").fill(editedEn);
    await adminPage.getByLabel("Name — Arabic").fill(editedAr);
    await expect(async () => {
      await adminPage.getByRole("button", { name: "Save Changes" }).click();
      await expect(adminPage).toHaveURL(/\/admin\/products$/, { timeout: 15000 });
    }).toPass({ timeout: 30000 });
    await adminContext.close();

    // The live product now has the edited name — editing the name also
    // re-derives the slug (spec: SEO-friendly URLs track the name), so
    // look up the product's current slug rather than assuming it is
    // unchanged.
    const updatedSnapshot = await db.collection("products").doc(product.id).get();
    const updatedSlug = updatedSnapshot.data()!.slug as string;
    await page.goto(`/en/shop/${updatedSlug}`);
    await expect(page.getByRole("heading", { name: editedEn })).toBeVisible();

    // But the already-placed order's confirmation page — in both
    // languages — still shows the ORIGINAL name captured at order time,
    // never the edited one.
    await page.goto(`/en/order-confirmation/${orderNumber}`);
    // Not `exact: true` — the order line renders as one combined text
    // node ("<product name> × N $..."), so the discriminator is that the
    // *edited* name never appears, not that the original name is the sole
    // content of its own text node.
    await expect(page.getByText(product.nameEn)).toBeVisible();
    await expect(page.getByText(editedEn)).toHaveCount(0);
    await expect(page.getByText("Pending", { exact: true })).toBeVisible();

    await page.goto(`/ar/order-confirmation/${orderNumber}`);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    // Not `exact: true` — same combined-text-node reasoning as above.
    await expect(page.getByText(product.nameAr)).toBeVisible();
    await expect(page.getByText(editedAr)).toHaveCount(0);
    await expect(page.getByText("قيد الانتظار", { exact: true })).toBeVisible();
  });
});
