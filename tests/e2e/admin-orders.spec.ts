import { test, expect, type Page } from "./fixtures/base";
import { loginAsAdmin, registerNewCustomer } from "./admin-helpers";
import { resetSeededStock } from "./fixtures/catalog-reset";

// This spec places a real order (decrementing seeded stock, T132's real
// behavior) — reset first so it never depends on, or leaks into, whatever
// another spec file already did to this shared product.
test.beforeAll(async () => {
  await resetSeededStock(["golden-bangle-bracelet"]);
});

/** T178 (quickstart Scenario 6): admin opens an order, changes its status, customer sees the update. */

async function placeOrder(page: Page): Promise<string> {
  await page.goto("/en/shop/category/bracelets");
  await expect(async () => {
    await page.getByRole("main").getByRole("button", { name: "Add to Cart" }).first().click();
    await expect(page.getByRole("main").getByRole("button", { name: "Add to Cart" }).first()).toBeEnabled({
      timeout: 2000,
    });
  }).toPass({ timeout: 20000 });

  await page.goto("/en/checkout");
  await page.getByLabel("Full Name").fill("Admin Orders Tester");
  await page.getByLabel("Mobile Phone Number").fill("+970599123456");
  await page.getByLabel("Email").fill(`admin-orders-${Date.now()}@example.com`);
  await page.getByLabel("Region").selectOption({ label: "West Bank" });
  await expect(async () => {
    const options = await page.getByLabel("City / Area").locator("option").count();
    expect(options).toBeGreaterThan(1);
  }).toPass({ timeout: 10000 });
  await page.getByLabel("City / Area").selectOption({ index: 1 });
  await page.getByLabel("Full Address").fill("123 Main Street");

  await expect(async () => {
    await page.getByRole("button", { name: "Place Order" }).click();
    await expect(page).toHaveURL(/\/order-confirmation\/ELR-\d{8}-\d{4}/, { timeout: 15000 });
  }).toPass({ timeout: 30000 });

  return page.url().match(/ELR-\d{8}-\d{4}/)?.[0] ?? "";
}

test("admin opens an order, changes its status, and the customer sees the update reflected", async ({ browser }) => {
  const customerContext = await browser.newContext();
  const customerPage = await customerContext.newPage();
  await registerNewCustomer(customerPage, "Order Status Tester", `admin-order-${Date.now()}`);
  const orderNumber = await placeOrder(customerPage);

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await loginAsAdmin(adminPage);

  await expect(async () => {
    await adminPage.goto("/admin/orders");
    await expect(adminPage.getByRole("link", { name: orderNumber })).toBeVisible({ timeout: 5000 });
  }).toPass({ timeout: 20000 });

  await expect(async () => {
    await adminPage.getByRole("link", { name: orderNumber }).click();
    await expect(adminPage).toHaveURL(/\/admin\/orders\/.+/, { timeout: 5000 });
  }).toPass({ timeout: 20000 });

  const statusSelect = adminPage.getByRole("main").locator("select");
  await expect(statusSelect).toHaveValue("PENDING");

  await expect(async () => {
    await statusSelect.selectOption("CONFIRMED");
    await expect(statusSelect).toHaveValue("CONFIRMED", { timeout: 10000 });
  }).toPass({ timeout: 20000 });

  await expect(async () => {
    await customerPage.goto("/en/account/orders");
    await expect(customerPage.getByText("Confirmed")).toBeVisible({ timeout: 5000 });
  }).toPass({ timeout: 30000 });

  await customerContext.close();
  await adminContext.close();
});
