import { test, expect, type Page } from "./fixtures/base";
import { loginAsAdmin, registerNewCustomer } from "./admin-helpers";
import { resetSeededStock } from "./fixtures/catalog-reset";
import { addCardToCart } from "./fixtures/add-to-cart";

/**
 * Production report: a signed-in customer's order-confirmation page "worked
 * once, then 404'd". There is ONE browser-wide `__session` cookie, so a second
 * tab in the same browser that signs in as someone else (e.g. the admin
 * checking the order in Admin Orders) replaces the customer's session; the
 * customer's tab then refreshes as the admin, who is deliberately not allowed
 * to view a customer's confirmation page. This reproduces that exact sequence.
 */
test.beforeAll(async () => {
  await resetSeededStock(["golden-bangle-bracelet"]);
});

async function placeOrder(page: Page): Promise<string> {
  await page.goto("/en/shop/category/bracelets");
  await addCardToCart(page, "Golden Bangle Bracelet");
  await page.goto("/en/checkout");
  await page.getByLabel("Full Name").fill("Session Collision Tester");
  await page.getByLabel("Mobile Phone Number").fill("+970599123456");
  await page.getByLabel("Email").fill(`collision-${Date.now()}@example.com`);
  await page.getByLabel("Region").selectOption({ label: "West Bank" });
  await expect(async () => {
    expect(await page.getByLabel("City / Area").locator("option").count()).toBeGreaterThan(1);
  }).toPass({ timeout: 30000 });
  await page.getByLabel("City / Area").selectOption({ index: 1 });
  await page.getByLabel("Full Address").fill("123 Main Street");
  await expect(async () => {
    await page.getByRole("button", { name: "Place Order" }).click();
    await expect(page).toHaveURL(/\/order-confirmation\/ELR-\d{8}-\d{4}/, { timeout: 15000 });
  }).toPass({ timeout: 30000 });
  return page.url().match(/ELR-\d{8}-\d{4}/)?.[0] ?? "";
}

const NOT_FOUND = "This page could not be found";

test("customer confirmation page keeps working after the admin signs in from another tab", async ({ context, page }) => {
  await registerNewCustomer(page, "Session Collision", `collision-${Date.now()}`);
  const orderNumber = await placeOrder(page);
  const url = `/en/order-confirmation/${orderNumber}`;

  // Works, and works again on refresh / direct reopen.
  await expect(page.getByText(orderNumber).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText(orderNumber).first()).toBeVisible();

  // The admin signs in from a second tab of the SAME browser.
  const adminTab = await context.newPage();
  await loginAsAdmin(adminTab);

  // The customer tab is refreshed / the URL reopened: must still be the customer's page.
  await page.goto(url);
  await expect(page.getByText(NOT_FOUND)).toHaveCount(0);
  await expect(page.getByText(orderNumber).first()).toBeVisible();

  // And the admin session is untouched: still an admin, still not shown the customer's page by a bypass.
  await adminTab.goto("/admin");
  await expect(adminTab).toHaveURL(/\/admin$/);
});
