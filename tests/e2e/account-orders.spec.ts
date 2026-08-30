import { test, expect, type Page } from "./fixtures/base";
import { resetSeededStock } from "./fixtures/catalog-reset";

/**
 * Account order-history/detail end-to-end coverage (T141, quickstart
 * Scenario 4, spec User Story 2): a registered customer places an order,
 * sees it as Pending in her order history, an admin updates its status,
 * and the customer sees the update live.
 *
 * "Admin updates status" is simulated via a direct Firestore Admin SDK
 * write from the test itself (mirrors `checkout-invalid.spec.ts`) since
 * Phase 10's admin order-status-transition UI doesn't exist yet.
 *
 * Requires the Firebase Local Emulator Suite running with
 * `scripts/seed.ts` already applied.
 */

const PASSWORD = "supersecret123";

async function getTestFirestore() {
  const { getApps, initializeApp } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  const app = getApps()[0] ?? initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID ?? "demo-elora" });
  return getFirestore(app);
}

async function setOrderStatus(orderNumber: string, status: string) {
  const { FieldValue } = await import("firebase-admin/firestore");
  const db = await getTestFirestore();
  const snapshot = await db.collection("orders").where("orderNumber", "==", orderNumber).limit(1).get();
  if (snapshot.empty) throw new Error(`Order not found: ${orderNumber}`);
  await snapshot.docs[0].ref.update({ status, updatedAt: FieldValue.serverTimestamp() });
}

async function registerNewCustomer(page: Page, name: string, emailPrefix: string): Promise<string> {
  let attempt = 0;
  let email = "";
  await expect(async () => {
    attempt += 1;
    email = `${emailPrefix}-attempt${attempt}@example.com`;
    await page.goto("/en/register");
    await page.getByLabel("Full Name").fill(name);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Create Account" }).click();
    await expect(page).not.toHaveURL(/\/register/, { timeout: 15000 });
  }).toPass({ timeout: 30000 });
  return email;
}

async function placeOrder(page: Page): Promise<string> {
  await page.goto("/en/shop/category/bracelets");
  await expect(async () => {
    await page.getByRole("main").getByRole("button", { name: "Add to Cart" }).first().click();
    await expect(page.getByRole("main").getByRole("button", { name: "Add to Cart" }).first()).toBeEnabled({
      timeout: 2000,
    });
  }).toPass({ timeout: 20000 });

  await page.goto("/en/checkout");
  await page.getByLabel("Full Name").fill("Jane Shopper");
  await page.getByLabel("Mobile Phone Number").fill("+970599123456");
  await page.getByLabel("Email").fill(`account-orders-${Date.now()}@example.com`);
  await page.getByLabel("Region").selectOption({ label: "West Bank" });
  await expect(async () => {
    const options = await page.getByLabel("City / Area").locator("option").count();
    expect(options).toBeGreaterThan(1);
  }).toPass({ timeout: 10000 });
  await page.getByLabel("City / Area").selectOption({ index: 1 });
  await page.getByLabel("Full Address").fill("123 Main Street");

  let orderNumber = "";
  await expect(async () => {
    await page.getByRole("button", { name: "Place Order" }).click();
    await expect(page).toHaveURL(/\/order-confirmation\/ELR-\d{8}-\d{4}/, { timeout: 15000 });
  }).toPass({ timeout: 30000 });
  orderNumber = page.url().match(/ELR-\d{8}-\d{4}/)?.[0] ?? "";
  expect(orderNumber).toBeTruthy();
  return orderNumber;
}

test.describe("account order history/detail", () => {
  // This spec places a real order (decrementing seeded stock, T132's
  // real behavior) — reset first so it never depends on, or leaks into,
  // whatever another spec file already did to this shared product.
  test.beforeAll(async () => {
    await resetSeededStock(["golden-bangle-bracelet"]);
  });

  test("registered customer places an order, sees Pending in history, admin updates status, customer sees the update", async ({
    page,
  }) => {
    await registerNewCustomer(page, "Order History Tester", `order-history-${Date.now()}`);
    const orderNumber = await placeOrder(page);

    await expect(async () => {
      await page.goto("/en/account/orders");
      await expect(page.getByText(orderNumber)).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 15000 });
    await expect(page.getByText("Pending")).toBeVisible();

    await expect(async () => {
      await page.getByText(orderNumber).click();
      await expect(page).toHaveURL(new RegExp(`/account/orders/${orderNumber}`), { timeout: 5000 });
    }).toPass({ timeout: 20000 });
    await expect(page.getByText("Golden Bangle Bracelet")).toBeVisible();
    await expect(page.getByText("Pending")).toBeVisible();

    // Simulate an admin status transition (Phase 10 UI doesn't exist yet).
    await setOrderStatus(orderNumber, "CONFIRMED");

    await expect(async () => {
      await page.reload();
      await expect(page.getByText("Confirmed")).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 15000 });

    await expect(async () => {
      await page.goto("/en/account/orders");
      await expect(page.getByText("Confirmed")).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 15000 });
  });

  test("a registered customer cannot view another customer's order via a guessed order number", async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await registerNewCustomer(pageA, "Customer A", `isolation-a-${Date.now()}`);
    const orderNumber = await placeOrder(pageA);

    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await registerNewCustomer(pageB, "Customer B", `isolation-b-${Date.now()}`);

    await pageB.goto(`/en/account/orders/${orderNumber}`);
    await expect(pageB.getByText("Order not found")).toBeVisible();
    await expect(pageB.getByText("Golden Bangle Bracelet")).toHaveCount(0);

    await contextA.close();
    await contextB.close();
  });

  test("a guest visiting /account/orders is redirected to login", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/en/account/orders");
    await expect(page).toHaveURL(/\/login\?next=/);
  });

  test("Arabic account orders page renders localized labels in RTL", async ({ page }) => {
    await registerNewCustomer(page, "Arabic Account Tester", `ar-account-${Date.now()}`);
    await page.goto("/ar/account/orders");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "سجل الطلبات", level: 1 })).toBeVisible();
  });
});
