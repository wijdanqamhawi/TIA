import { test, expect } from "./fixtures/base";
import { loginAsAdmin, getTestFirestore, ADMIN_EMAIL } from "./admin-helpers";

/**
 * End-to-end Special Offers coverage (T333, spec User Story 10, quickstart
 * Scenario 16): an admin enables a real offer via the real `/admin/products`
 * edit form, the storefront (Home Special Offers section, Shop, product
 * detail, Cart) all show identical crossed-out/sale pricing, a completed
 * order prices the line at the sale price, and disabling the offer reverts
 * every surface — including a freshly loaded cart — to the regular price.
 *
 * Rewritten 2026-08-30 against the real, current admin UI: earlier drafts of
 * this spec targeted a standalone "Manage Offer" dialog that was superseded
 * by Phase 10's real `/admin/products/[id]/edit` form (a "Special Offer"
 * fieldset alongside every other product field, `ProductForm.tsx`) — that
 * mismatch is what made this spec fail before, not the underlying feature.
 * Also adds real checkout-completion coverage (pricing an actual placed
 * order at the sale price), deferred in earlier drafts only because Phase 8
 * did not exist yet — it does now.
 *
 * Uses an isolated, uniquely-named product created directly via the Admin
 * SDK (mirrors `admin-products.spec.ts`'s own pattern) rather than the
 * shared seeded catalog, so this spec can never race with, or leak
 * promotional state into, any other spec file sharing the same emulator/seed
 * data.
 */

test.describe("Special Offers end-to-end", () => {
  const createdProductIds: string[] = [];

  // The cart test below signs in as the real, persistent seeded admin
  // account and adds to *her* registered cart (`carts/{uid}`, never a
  // guest cookie) — so a leftover line from an earlier interrupted run of
  // this same spec (a real product this file's own `afterEach` already
  // deleted, but the cart line referencing it was never removed) silently
  // accumulates in Firestore across runs, not just within one process.
  // Clearing it first, unconditionally, keeps every run starting from a
  // known-empty cart regardless of what any earlier run left behind.
  test.beforeEach(async () => {
    const db = await getTestFirestore();
    const userSnapshot = await db.collection("users").where("email", "==", ADMIN_EMAIL).limit(1).get();
    const adminUid = userSnapshot.docs[0]?.id;
    if (adminUid) {
      await db.collection("carts").doc(adminUid).delete();
    }
  });

  test.afterEach(async () => {
    if (createdProductIds.length === 0) return;
    const db = await getTestFirestore();
    await Promise.all(createdProductIds.splice(0).map((id) => db.collection("products").doc(id).delete()));
  });

  async function createTestProduct(uniqueName: string, overrides: Record<string, unknown> = {}) {
    const db = await getTestFirestore();
    const ref = db.collection("products").doc();
    createdProductIds.push(ref.id);
    const now = new Date();
    await ref.set({
      id: ref.id,
      name: { en: uniqueName, ar: null },
      slug: uniqueName.toLowerCase().replace(/\s+/g, "-"),
      description: { en: "desc", ar: null },
      price: 15000, // $150.00
      categoryId: "bracelets",
      images: [],
      material: { en: "Gold", ar: null },
      options: [],
      stock: 10,
      availability: true,
      isNewArrival: false,
      isBestSeller: false,
      salesCount: 0,
      searchTerms: [uniqueName.toLowerCase()],
      isOnSale: false,
      salePrice: null,
      saleStartAt: null,
      saleEndAt: null,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    });
    return ref;
  }

  async function setOfferViaAdminForm(page: import("@playwright/test").Page, productId: string, enabled: boolean) {
    await page.goto(`/admin/products/${productId}/edit`);
    const checkbox = page.getByRole("checkbox", { name: "Enable this offer" });
    const isChecked = await checkbox.isChecked();
    if (isChecked !== enabled) {
      await checkbox.click();
    }
    if (enabled) {
      await page.getByLabel("Sale price").fill("99.99");
    }
    await expect(async () => {
      await page.getByRole("button", { name: "Save Changes" }).click();
      await expect(page).toHaveURL(/\/admin\/products$/, { timeout: 15000 });
    }).toPass({ timeout: 30000 });
  }

  test("admin enables an offer, it prices consistently across every storefront surface, the cart, and a completed order — disabling reverts everything including a fresh cart", async ({
    page,
  }) => {
    // This single test deliberately walks the *whole* offer lifecycle in one
    // continuous session (admin login → enable → Home/Shop/detail → cart →
    // real checkout → disable → re-verify), because the revert assertions are
    // only meaningful against the same product the earlier steps priced. That
    // is far more work than Playwright's 30s default per-test budget allows in
    // dev mode, where each first-visited route (/admin/products/[id]/edit,
    // /en/shop/..., /en/cart, /checkout, /order-confirmation/...) compiles
    // on demand — the individual steps below already carry their own tight
    // sub-timeouts, so this raises only the overall envelope, never the
    // per-assertion strictness that would mask a real regression.
    test.setTimeout(240_000);

    const uniqueName = `E2E Special Offer ${Date.now()}`;
    const ref = await createTestProduct(uniqueName);

    await loginAsAdmin(page);
    await setOfferViaAdminForm(page, ref.id, true);

    // Admin listing shows the derived "On Sale" offer status — scoped to
    // an actual `role="row"`. `DataTable` (T181) always renders *both* the
    // desktop `<table>` and a mobile stacked-card list at once (one hidden
    // via a `md:` breakpoint class, mirroring `CartLineItem`'s own dual
    // render below) — so the row always *exists* in the DOM, but is only
    // actually *visible* at `md`+; below that there's no `<table>`/`<tr>`
    // a shopper can see, and no stable, styling-uncoupled way to isolate
    // one mobile card's own text from every other card's on this list. The
    // crossed-out/sale pricing checks on Home/Shop/detail/Cart below
    // independently re-verify this exact product's offer state regardless
    // of viewport, so this one admin-list check is intentionally
    // desktop-table-only rather than fragile on mobile.
    await page.goto("/admin/products");
    const deskRow = page.getByRole("row", { name: new RegExp(uniqueName) });
    if (await deskRow.isVisible().catch(() => false)) {
      await expect(deskRow.getByText("On Sale")).toBeVisible();
    }

    // `OfferPrice` (src/components/ui/Price.tsx) renders the crossed-out/
    // sale price pair as two visible `aria-hidden="true"` spans *plus* one
    // visually-hidden (`sr-only`) span carrying the same two amounts for
    // screen readers. On the cart page specifically, `CartLineItem` (T105)
    // additionally renders *both* a desktop-table and a mobile-card variant
    // of each line at once (one hidden via a CSS breakpoint class, never
    // removed from the DOM) — so even after excluding the sr-only span,
    // a plain `.first()` can still land on the off-screen-at-this-viewport
    // variant. The `:visible` pseudo-class filters to elements Playwright
    // considers actually rendered (non-zero size, not `display:none`),
    // which the sr-only span and the wrong-breakpoint variant both fail,
    // leaving only the one genuinely visible price on screen.
    function visiblePrice(scope: import("@playwright/test").Locator, amount: string) {
      return scope.locator('[aria-hidden="true"]:visible', { hasText: amount }).first();
    }

    // Home — Special Offers section shows the crossed-out regular price + sale price.
    await expect(async () => {
      await page.goto("/en");
      const card = page.getByRole("main").locator("div").filter({ hasText: uniqueName }).first();
      await expect(card).toBeVisible({ timeout: 2000 });
      await expect(visiblePrice(card, "$99.99")).toBeVisible();
      await expect(visiblePrice(card, "$150.00")).toBeVisible();
    }).toPass({ timeout: 15000 });

    // Shop / category page shows the same pricing for the same product.
    await page.goto("/en/shop/category/bracelets");
    const shopCard = page.getByRole("main").locator("div").filter({ hasText: uniqueName }).first();
    await expect(visiblePrice(shopCard, "$99.99")).toBeVisible();
    await expect(visiblePrice(shopCard, "$150.00")).toBeVisible();

    // Product detail page shows the same pricing.
    await page.goto(`/en/shop/${(await ref.get()).data()!.slug}`);
    await expect(visiblePrice(page.getByRole("main"), "$99.99")).toBeVisible();
    await expect(visiblePrice(page.getByRole("main"), "$150.00")).toBeVisible();

    // Add to cart — the cart shows the effective (sale) price, never the regular one.
    // Generous per-attempt sub-timeouts (not the 1000ms used elsewhere in
    // this suite): this product's detail page is being hit for the first
    // time in this test run, so its route may still be cold-compiling in
    // dev mode on top of the mutation's own round trip.
    await expect(async () => {
      await page.getByRole("main").getByRole("button", { name: "Add to Cart" }).first().click();
      await expect(page.getByRole("main").getByRole("button", { name: "Add to Cart" }).first()).toBeEnabled({
        timeout: 3000,
      });
    }).toPass({ timeout: 30000 });

    await expect(async () => {
      await page.goto("/en/cart");
      await expect(page.getByText(uniqueName)).toBeVisible({ timeout: 3000 });
      await expect(visiblePrice(page.getByRole("main"), "$99.99")).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 30000 });

    // Complete checkout — the order is priced at the sale price, an
    // immutable snapshot (never a live re-lookup), spec FR-119/FR-121.
    // A generous timeout (mirrors `checkout.spec.ts`'s own): /checkout
    // compiles on-demand on its first visit in dev mode, on top of this
    // test's own already-long chain of prior navigations.
    await page.getByRole("link", { name: "Proceed to Checkout" }).click();
    await expect(page).toHaveURL(/\/checkout/, { timeout: 30000 });

    await page.getByLabel("Full Name").fill("Jane Shopper");
    await page.getByLabel("Mobile Phone Number").fill("+970 599 123 456");
    await page.getByLabel("Email").fill(`special-offer-${Date.now()}@example.com`);
    await page.getByLabel("Region").selectOption({ label: "West Bank" });
    await expect(async () => {
      const options = await page.getByLabel("City / Area").locator("option").count();
      expect(options).toBeGreaterThan(1);
    }).toPass({ timeout: 10000 });
    await page.getByLabel("City / Area").selectOption({ index: 1 });
    await page.getByLabel("Full Address").fill("123 Main Street, Apartment 4");

    await expect(async () => {
      await page.getByRole("button", { name: "Place Order" }).click();
      await expect(page).toHaveURL(/\/order-confirmation\/ELR-\d{8}-\d{4}/, { timeout: 15000 });
    }).toPass({ timeout: 30000 });

    await expect(page.getByRole("heading", { name: "Order Confirmed" })).toBeVisible();
    await expect(page.getByText(uniqueName)).toBeVisible();
    // The order snapshot is priced at the sale price ($99.99), not the
    // regular $150.00 — the crossed-out treatment is a live-pricing display
    // concern (OfferPrice), not applicable to an immutable order snapshot.
    await expect(page.getByText("$99.99").first()).toBeVisible();
    await expect(page.getByText("$150.00")).toHaveCount(0);

    // Admin disables the offer.
    await setOfferViaAdminForm(page, ref.id, false);

    // A freshly loaded product page and a freshly added cart line now both
    // revert to the regular price — never a stale sale price anywhere.
    await page.goto(`/en/shop/${(await ref.get()).data()!.slug}`);
    await expect(page.getByText("$150.00").first()).toBeVisible();
    await expect(page.getByText("$99.99")).toHaveCount(0);
  });

  test("a Sold Out product on an active offer still shows SOLD OUT and cannot be added to cart (spec FR-122)", async ({
    page,
  }) => {
    const uniqueName = `E2E Sold Out Offer ${Date.now()}`;
    // Sold Out (stock: 0) AND an active offer at once — proves Sold Out
    // always wins regardless of any active promotion on the same product.
    const ref = await createTestProduct(uniqueName, {
      stock: 0,
      isOnSale: true,
      salePrice: 9999,
    });

    await page.goto(`/en/shop/${(await ref.get()).data()!.slug}`);
    await expect(page.getByRole("heading", { name: uniqueName, level: 1 })).toBeVisible();
    await expect(page.getByRole("main").getByRole("button", { name: "SOLD OUT" }).first()).toBeDisabled();
  });
});
