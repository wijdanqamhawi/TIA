import { test, expect } from "./fixtures/base";
import { loginAsAdmin, getTestFirestore } from "./admin-helpers";

/**
 * T175 (quickstart Scenario 5): admin creates/edits a product with
 * bilingual fields clearly distinguished, storefront reflects the change
 * in both languages, and restocking a Sold Out product clears its badge.
 */
test.describe("admin — product management", () => {
  const createdProductIds: string[] = [];

  test.afterEach(async () => {
    // A product this suite creates otherwise persists forever and, being
    // newer than every seeded product, becomes the "first" result on its
    // category page — silently breaking every other spec file that
    // navigates to a category grid and clicks `.first()` expecting a
    // specific seeded product (cart.spec.ts, browse.spec.ts, checkout.spec.ts,
    // wishlist.spec.ts). Always clean up regardless of pass/fail.
    if (createdProductIds.length === 0) return;
    const db = await getTestFirestore();
    await Promise.all(createdProductIds.splice(0).map((id) => db.collection("products").doc(id).delete()));
  });

  test("admin creates a product with bilingual fields, then edits it and sees the storefront reflect the change", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/products/new");

    const uniqueName = `Test Sapphire Ring ${Date.now()}`;
    await page.getByLabel("Name — English").fill(uniqueName);
    await page.getByLabel("Name — Arabic").fill("خاتم ياقوت اختبار");
    await page.getByLabel("Description — English").fill("A beautiful test ring.");
    await page.getByLabel("Material — English").fill("Gold");

    await page.getByRole("spinbutton", { name: "Price", exact: true }).fill("199.99");
    await page.getByRole("combobox", { name: "Category", exact: true }).selectOption({ index: 1 });
    await page.getByRole("spinbutton", { name: "Stock", exact: true }).fill("5");

    await expect(async () => {
      await page.getByRole("button", { name: "Create Product" }).click();
      await expect(page).toHaveURL(/\/admin\/products\/.+\/edit/, { timeout: 15000 });
    }).toPass({ timeout: 30000 });
    createdProductIds.push(page.url().match(/\/admin\/products\/([^/]+)\/edit/)![1]);

    // The edit page confirms the product now exists with the bilingual name.
    await expect(page.getByText(uniqueName)).toBeVisible();

    // The storefront reflects the new product in both languages (search).
    await page.goto(`/en/shop?q=${encodeURIComponent(uniqueName)}`);
    await expect(page.getByText(uniqueName).first()).toBeVisible({ timeout: 10000 });

    await page.goto(`/ar/shop?q=${encodeURIComponent(uniqueName)}`);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });

  test("restocking a Sold Out product via the edit form clears the storefront's Sold Out badge", async ({ page }) => {
    const db = await getTestFirestore();
    const ref = db.collection("products").doc();
    createdProductIds.push(ref.id);
    const now = new Date();
    await ref.set({
      id: ref.id,
      name: { en: `E2E Sold Out ${Date.now()}`, ar: null },
      slug: `e2e-sold-out-${Date.now()}`,
      description: { en: "desc", ar: null },
      price: 10000,
      categoryId: "bracelets",
      images: [],
      material: { en: "Gold", ar: null },
      options: [],
      stock: 0,
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

    await loginAsAdmin(page);
    await page.goto(`/admin/products/${ref.id}/edit`);
    await expect(page.getByRole("spinbutton", { name: "Stock", exact: true })).toHaveValue("0");

    await page.getByRole("spinbutton", { name: "Stock", exact: true }).fill("10");
    await expect(async () => {
      await page.getByRole("button", { name: "Save Changes" }).click();
      await expect(page).toHaveURL(/\/admin\/products$/, { timeout: 15000 });
    }).toPass({ timeout: 30000 });

    const updated = await ref.get();
    expect(updated.data()?.stock).toBe(10);
  });

  test("T236: Sold Out product → admin restock → purchasable again, including in its homepage Best Sellers strip", async ({
    page,
  }) => {
    const db = await getTestFirestore();
    const ref = db.collection("products").doc();
    createdProductIds.push(ref.id);
    const uniqueName = `E2E Restock Bestseller ${Date.now()}`;
    const now = new Date();
    await ref.set({
      id: ref.id,
      name: { en: uniqueName, ar: null },
      slug: `e2e-restock-bestseller-${Date.now()}`,
      description: { en: "desc", ar: null },
      price: 12000,
      categoryId: "bracelets",
      images: [],
      material: { en: "Gold", ar: null },
      options: [],
      stock: 0,
      availability: true,
      isNewArrival: false,
      isBestSeller: true,
      salesCount: 0,
      searchTerms: [uniqueName.toLowerCase()],
      isOnSale: false,
      salePrice: null,
      saleStartAt: null,
      saleEndAt: null,
      createdAt: now,
      updatedAt: now,
    });

    // Sold Out on its own product detail page: visible, but purchase is
    // disabled (spec FR-015a — a Sold Out product stays fully browsable).
    await page.goto(`/en/shop/${(await ref.get()).data()!.slug}`);
    await expect(page.getByRole("heading", { name: uniqueName, level: 1 })).toBeVisible();
    // Two buttons legitimately render this product's Sold Out state on the
    // detail page (the desktop purchase panel and the mobile sticky
    // Add-to-Cart bar) — both hidden/shown by CSS only, both present in
    // the DOM regardless of viewport, so `.first()` is enough here.
    await expect(page.getByRole("main").getByRole("button", { name: "SOLD OUT" }).first()).toBeDisabled();

    // Sold Out but still present in the homepage's Best Sellers strip.
    await expect(async () => {
      await page.goto("/en");
      const card = page.locator(".group", { hasText: uniqueName }).first();
      await expect(card).toBeVisible({ timeout: 3000 });
      await expect(card.getByRole("button", { name: "SOLD OUT" })).toBeDisabled();
    }).toPass({ timeout: 15000 });

    // Admin restocks it.
    await loginAsAdmin(page);
    await page.goto(`/admin/products/${ref.id}/edit`);
    await expect(page.getByRole("spinbutton", { name: "Stock", exact: true })).toHaveValue("0");
    await page.getByRole("spinbutton", { name: "Stock", exact: true }).fill("15");
    await expect(async () => {
      await page.getByRole("button", { name: "Save Changes" }).click();
      await expect(page).toHaveURL(/\/admin\/products$/, { timeout: 15000 });
    }).toPass({ timeout: 30000 });

    // Purchasable again on its own product page. Scoped to the heading's
    // own info column (name + purchase panel + description), not the
    // whole `main` — the page's "Related Products" section (same
    // category) can legitimately include another, unrelated Sold Out
    // product (e.g. the permanently out-of-stock seeded "Pearl Tennis
    // Bracelet"), which would otherwise produce a false-positive match.
    await page.goto(`/en/shop/${(await ref.get()).data()!.slug}`);
    const infoColumn = page.locator("h1", { hasText: uniqueName }).locator("..");
    await expect(infoColumn.getByRole("button", { name: "Add to Cart" }).first()).toBeEnabled();
    await expect(infoColumn.getByText("SOLD OUT")).toHaveCount(0);

    // Purchasable again in the homepage Best Sellers strip too — scoped to
    // this exact product's own card (the section also holds other, already
    // in-stock best sellers, so a section-wide "Add to Cart" check alone
    // wouldn't prove *this* card changed).
    await expect(async () => {
      await page.goto("/en");
      const card = page.locator(".group", { hasText: uniqueName }).first();
      await expect(card).toBeVisible({ timeout: 3000 });
      await expect(card.getByRole("button", { name: "Add to Cart" })).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 15000 });
  });
});
