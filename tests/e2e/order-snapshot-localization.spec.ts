import { test, expect, type Page } from "./fixtures/base";
import { resetSeededStock } from "./fixtures/catalog-reset";
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

async function addFirstBraceletToCart(page: Page) {
  await page.goto("/en/shop/category/bracelets");
  // A single click, then wait out the Server Action's own pending state —
  // not retry-wrapped around the click itself: under load, a too-short
  // inner timeout previously caused a retry to re-click and silently add
  // quantity >1, corrupting this test's assumption of a single unit.
  const addButton = page.getByRole("main").getByRole("button", { name: "Add to Cart" }).first();
  await expect(addButton).toBeEnabled({ timeout: 15000 });
  await addButton.click();
  await expect(addButton).toBeEnabled({ timeout: 15000 });
}

test.describe("order snapshot localization survives a later product edit", () => {
  let originalName: { en: string; ar: string | null } | undefined;
  let originalSlug: string | undefined;
  let productId: string | undefined;

  test.beforeAll(async () => {
    await resetSeededStock(["golden-bangle-bracelet"]);
  });

  test.afterAll(async () => {
    // Restore the product's original bilingual name AND slug so this
    // doesn't leak into any other spec file sharing the seeded catalog —
    // `updateProductAction` re-derives `slug` from the English name on
    // every edit (spec: SEO-friendly URLs stay in sync with the name), so
    // editing the name here also changes the live slug and must be
    // reverted alongside it.
    if (!productId || !originalName || !originalSlug) return;
    const db = await getTestFirestore();
    await db.collection("products").doc(productId).update({ name: originalName, slug: originalSlug });
  });

  test("historical order snapshot and status label stay correct after a product-translation edit", async ({
    page,
    browser,
  }) => {
    // Registration + a full real checkout + a second admin browser
    // context editing the product + re-verifying both locale confirmation
    // pages is a heavier flow than this suite's usual 30s default budget.
    test.setTimeout(60000);

    const email = `order-snapshot-${Date.now()}@example.com`;

    // Register and place a real order as a customer, in her own session.
    await page.goto("/en/register");
    await page.getByLabel("Full Name").fill("Snapshot Tester");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("supersecret123");
    await page.getByRole("button", { name: "Create Account" }).click();
    await expect(page).not.toHaveURL(/\/register/, { timeout: 15000 });

    await addFirstBraceletToCart(page);
    await page.goto("/en/checkout");
    await page.getByLabel("Mobile Phone Number").fill("+970599123456");
    await page.getByLabel("Region").selectOption({ label: "West Bank" });
    await expect(async () => {
      const options = await page.getByLabel("City / Area").locator("option").count();
      expect(options).toBeGreaterThan(1);
    }).toPass({ timeout: 10000 });
    await page.getByLabel("City / Area").selectOption({ index: 1 });
    await page.getByLabel("Full Address").fill("123 Main Street");

    await expect(async () => {
      await page.getByRole("button", { name: "Place Order" }).click();
      await expect(page).toHaveURL(/\/order-confirmation\/(ELR-\d{8}-\d{4})/, { timeout: 15000 });
    }).toPass({ timeout: 30000 });

    const orderNumber = page.url().match(/ELR-\d{8}-\d{4}/)?.[0];
    expect(orderNumber).toBeTruthy();

    await expect(page.getByText("Golden Bangle Bracelet")).toBeVisible();
    await expect(page.getByText("Pending", { exact: true })).toBeVisible();

    // Confirm the stored `status` is the raw enum value, not a translated string.
    const db = await getTestFirestore();
    const orderSnapshot = await db.collection("orders").where("orderNumber", "==", orderNumber).limit(1).get();
    expect(orderSnapshot.docs[0].data().status).toBe("PENDING");

    // Find the product and record its original name for cleanup, then
    // edit it as admin — a separate browser context so the customer's own
    // session/cookies are untouched.
    const productSnapshot = await db
      .collection("products")
      .where("slug", "==", "golden-bangle-bracelet")
      .limit(1)
      .get();
    productId = productSnapshot.docs[0].id;
    originalName = productSnapshot.docs[0].data().name;
    originalSlug = productSnapshot.docs[0].data().slug;

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await loginAsAdmin(adminPage);
    await adminPage.goto(`/admin/products/${productId}/edit`);
    await adminPage.getByLabel("Name — English").fill("Golden Bangle Bracelet EDITED");
    await adminPage.getByLabel("Name — Arabic").fill("سوار ذهبي معدّل");
    await expect(async () => {
      await adminPage.getByRole("button", { name: "Save Changes" }).click();
      await expect(adminPage).toHaveURL(/\/admin\/products$/, { timeout: 15000 });
    }).toPass({ timeout: 30000 });
    await adminContext.close();

    // The live product now has the edited name — editing the name also
    // re-derives the slug (spec: SEO-friendly URLs track the name), so
    // look up the product's current slug rather than assuming it's still
    // "golden-bangle-bracelet".
    const updatedSnapshot = await db.collection("products").doc(productId).get();
    const updatedSlug = updatedSnapshot.data()!.slug as string;
    await page.goto(`/en/shop/${updatedSlug}`);
    await expect(page.getByRole("heading", { name: "Golden Bangle Bracelet EDITED" })).toBeVisible();

    // But the already-placed order's confirmation page — in both
    // languages — still shows the ORIGINAL name captured at order time,
    // never the edited one.
    await page.goto(`/en/order-confirmation/${orderNumber}`);
    // Not `exact: true` — the order line renders as one combined text
    // node ("Golden Bangle Bracelet × N $..."), so the discriminator is
    // that the *edited* name never appears, not that the original name is
    // the sole content of its own text node.
    await expect(page.getByText("Golden Bangle Bracelet")).toBeVisible();
    await expect(page.getByText("Golden Bangle Bracelet EDITED")).toHaveCount(0);
    await expect(page.getByText("Pending", { exact: true })).toBeVisible();

    await page.goto(`/ar/order-confirmation/${orderNumber}`);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    // Not `exact: true` — same combined-text-node reasoning as above.
    await expect(page.getByText("سوار ذهبي")).toBeVisible();
    await expect(page.getByText("سوار ذهبي معدّل")).toHaveCount(0);
    await expect(page.getByText("قيد الانتظار", { exact: true })).toBeVisible();
  });
});
