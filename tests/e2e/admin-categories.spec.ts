import { test, expect } from "./fixtures/base";
import { loginAsAdmin, getTestFirestore } from "./admin-helpers";

/**
 * T176: admin deactivates a category, confirms it disappears from
 * `CategorySelect` and customer-facing navigation, then reactivates it and
 * changes its display order.
 */
test.describe("admin — category management", () => {
  let cleanupRef: FirebaseFirestore.DocumentReference | null = null;

  test.afterEach(async () => {
    // A leftover test category otherwise accumulates forever (this file's
    // own `categories` collection has no natural TTL) and breaks any test
    // or fixture that asserts an exact category count (e.g.
    // catalog-seed.test.ts's "exactly the four core categories" check).
    if (cleanupRef) {
      await cleanupRef.delete();
      cleanupRef = null;
    }
  });

  test("deactivating a category hides it from CategorySelect and the storefront nav; reactivating restores it", async ({
    page,
  }) => {
    const db = await getTestFirestore();
    const now = new Date();
    const ref = db.collection("categories").doc();
    cleanupRef = ref;
    const categoryName = `E2E Category ${Date.now()}`;
    await ref.set({
      id: ref.id,
      name: { en: categoryName, ar: null },
      slug: `e2e-category-${Date.now()}`,
      description: null,
      displayOrder: 99,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    await loginAsAdmin(page);
    await page.goto("/admin/categories");
    // By role, not `getByText(...).last()`: the admin list renders a
    // desktop table *and* a phone card list at once, one of them hidden by
    // a CSS breakpoint, and the text query happily resolved to the hidden
    // variant on the phone projects. Role queries read the accessibility
    // tree, which the hidden variant is not in.
    await expect(page.getByRole("button", { name: categoryName })).toBeVisible();

    // Deactivate via the admin UI.
    await page.getByRole("button", { name: categoryName }).click();
    await page.getByLabel(/Active \(visible on storefront\)/).uncheck();
    await expect(async () => {
      await page.getByRole("button", { name: "Save" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 10000 });
    }).toPass({ timeout: 20000 });

    // Now hidden from the admin product form's CategorySelect (T153: active only).
    await page.goto("/admin/products/new");
    await expect(page.locator('label:has-text("Category") select option', { hasText: categoryName })).toHaveCount(0);

    // And hidden from customer-facing navigation.
    await page.goto("/en");
    await expect(page.getByRole("navigation").getByText(categoryName)).toHaveCount(0);

    // Reactivate and change display order.
    await page.goto("/admin/categories");
    await page.getByRole("button", { name: categoryName }).click();
    await page.getByLabel(/Active \(visible on storefront\)/).check();
    await page.locator('label:has-text("Display order") input').fill("1");
    await expect(async () => {
      await page.getByRole("button", { name: "Save" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 10000 });
    }).toPass({ timeout: 20000 });

    await page.goto("/admin/products/new");
    await expect(page.locator('label:has-text("Category") select option', { hasText: categoryName })).toHaveCount(1);

    const updated = await ref.get();
    expect(updated.data()?.isActive).toBe(true);
    expect(updated.data()?.displayOrder).toBe(1);
  });
});
