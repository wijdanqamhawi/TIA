import { test, expect, type Page } from "./fixtures/base";
import { resetSeededStock } from "./fixtures/catalog-reset";
import { loginAsAdmin } from "./admin-helpers";

/**
 * Delivery Location Selector end-to-end coverage (T290, quickstart
 * Scenario 14): the persistent navbar/mobile-nav location selector for
 * the two approved regions (West Bank / Inside-1948), bilingual search,
 * persistence across navigation/refresh, checkout prefill + change-
 * before-submit, and admin-managed list changes reflected immediately
 * with no code change.
 *
 * Requires the Firebase Local Emulator Suite running with
 * `scripts/seed.ts` already applied (seeds the two regions and their
 * cities/areas, including `Ramallah` under `west-bank` and `Haifa` under
 * `inside-1948`).
 */

async function getTestFirestore() {
  const { getApps, initializeApp } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  const app = getApps()[0] ?? initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID ?? "demo-elora" });
  return getFirestore(app);
}

/**
 * Opens the location-selector dialog whichever surface is visible at the
 * current viewport — the desktop navbar's own trigger (`hidden lg:block`)
 * on wide viewports, or the hamburger-menu's copy (T276) on narrow ones.
 * Both `LocationSelector` instances (Navbar + MobileNav) always mount
 * their own native `<dialog>`, so every subsequent interaction must be
 * scoped to `openLocationDialog()`'s `dialog[open]` — a plain
 * `getByRole("dialog")`/`getByLabel(...)` can match the other instance's
 * always-present-but-closed element too.
 */
async function openLocationSelector(page: Page) {
  const trigger = page.getByRole("button", { name: /Select delivery location|اختاري موقع التوصيل/ }).first();
  try {
    await expect(trigger).toBeVisible({ timeout: 5000 });
  } catch {
    await page.getByRole("button", { name: /Open menu|فتح القائمة/ }).click();
  }
  await page.getByRole("button", { name: /Select delivery location|اختاري موقع التوصيل/ }).first().click();
  await expect(openLocationDialog(page)).toBeVisible();
}

function openLocationDialog(page: Page) {
  return page.locator("dialog[open]");
}

/** Asserts the trigger shows `label` — opening the hamburger menu first on narrow (< md) viewports, where the trigger only exists inside the (closed-by-default) mobile panel. */
async function expectLocationTrigger(page: Page, label: string) {
  const trigger = page.getByRole("button", { name: label });
  try {
    await expect(trigger).toBeVisible({ timeout: 5000 });
    return;
  } catch {
    // Not reachable directly — narrow viewport, trigger lives behind the
    // hamburger menu instead of the always-`md:block` navbar copy.
  }
  await page.getByRole("button", { name: /Open menu|فتح القائمة/ }).click();
  await expect(trigger).toBeVisible();
}

async function addFirstProductToCart(page: Page) {
  // Add directly from the category grid card (no option picker there, so
  // Add to Cart works immediately) for the known in-stock seeded product
  // by name — never `.first()`, since the intentionally-sold-out
  // `pearl-tennis-bracelet` (0 stock, per `resetSeededStock`'s baseline)
  // can render before it and would otherwise be picked instead.
  await page.goto("/en/shop/category/bracelets");
  const card = page
    .locator("div")
    .filter({ has: page.getByRole("link", { name: "Golden Bangle Bracelet" }) })
    .filter({ has: page.getByRole("button", { name: "Add to Cart" }) })
    .last();
  // A single click, then wait for the server action to resolve — not a
  // retry-wrapped click, which can silently double-click and corrupt the
  // assumed quantity=1 if the first click's re-enable check is still slow.
  await card.getByRole("button", { name: "Add to Cart" }).click();
  await expect(card.getByRole("button", { name: "Add to Cart" })).toBeEnabled({ timeout: 15000 });
}

test.describe("delivery location selector", () => {
  test.beforeAll(async () => {
    await resetSeededStock(["golden-bangle-bracelet"]);
  });

  test("selecting a location from the navbar persists across navigation and reload", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/en");

    await openLocationSelector(page);
    const dialog = openLocationDialog(page);
    await dialog.getByLabel("Search for a city or area…").fill("Ramallah");
    await dialog.getByRole("button", { name: "Ramallah" }).click();
    await expect(dialog).toBeHidden();
    await expectLocationTrigger(page, "Ramallah");

    await page.goto("/en/shop");
    await expectLocationTrigger(page, "Ramallah");

    await page.reload();
    await expectLocationTrigger(page, "Ramallah");
  });

  test("bilingual search matches an Arabic query on the /ar storefront", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/ar");

    await openLocationSelector(page);
    const dialog = openLocationDialog(page);
    await dialog.getByLabel("ابحثي عن مدينة أو حي…").fill("حيفا");
    await dialog.getByRole("button", { name: "حيفا" }).click();
    await expect(dialog).toBeHidden();
    await expectLocationTrigger(page, "حيفا");
  });

  test("checkout prefills the persisted location and allows changing it before submitting", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/en");
    await openLocationSelector(page);
    const navbarDialog = openLocationDialog(page);
    await navbarDialog.getByLabel("Search for a city or area…").fill("Ramallah");
    await navbarDialog.getByRole("button", { name: "Ramallah" }).click();
    await expect(navbarDialog).toBeHidden();

    await addFirstProductToCart(page);
    await page.goto("/en/cart");
    await page.getByRole("link", { name: "Proceed to Checkout" }).click();
    await expect(page).toHaveURL(/\/checkout/, { timeout: 15000 });

    await expect(page.getByText("Selected: Ramallah")).toBeVisible({ timeout: 15000 });
    await expect(page.getByLabel("Region")).toHaveValue(/.+/);
    await expect(async () => {
      const cityValue = await page.getByLabel("City / Area").inputValue();
      expect(cityValue).not.toBe("");
    }).toPass({ timeout: 10000 });

    // Change the location before submitting — a fresh dialog reopen, not
    // the plain region/city dropdowns, per T279. The checkout page mounts
    // its own `LocationSelectorDialog` distinct from the navbar's (both
    // are always in the DOM as native <dialog> elements), so every
    // interaction below is scoped to the one this click actually opens.
    await page.getByRole("button", { name: "Change" }).click();
    const changeDialog = openLocationDialog(page);
    await expect(changeDialog).toBeVisible();
    await changeDialog.getByLabel("Search for a city or area…").fill("Nablus");
    await changeDialog.getByRole("button", { name: "Nablus" }).click();
    await expect(changeDialog).toBeHidden();
    await expect(page.getByText("Selected: Nablus")).toBeVisible();

    await page.getByLabel("Full Name").fill("Location Shopper");
    await page.getByLabel("Mobile Phone Number").fill("+970 599 555 111");
    await page.getByLabel("Email").fill(`location-checkout-${Date.now()}@example.com`);
    await page.getByLabel("Full Address").fill("45 Olive Street");

    await page.getByRole("button", { name: "Place Order" }).click();
    await expect(page).toHaveURL(/\/order-confirmation\/ELR-\d{8}-\d{4}/, { timeout: 45000 });

    await expect(page.getByText("West Bank — Nablus")).toBeVisible();
  });

  test("an admin-added city appears in the storefront selector with no code change", async ({ page }) => {
    const db = await getTestFirestore();

    await loginAsAdmin(page);
    await page.goto("/admin/locations");
    await expect(page.getByRole("heading", { name: "Delivery Locations" })).toBeVisible({ timeout: 15000 });
    const westBankSection = page.locator("section", { has: page.getByRole("button", { name: "West Bank" }) });
    await expect(westBankSection).toBeVisible();

    await westBankSection.getByRole("button", { name: "+ Add City / Area" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByLabel("Name — English").fill("Jericho");
    await page.getByLabel("Name — Arabic").fill("أريحا");
    await expect(async () => {
      await page.getByRole("button", { name: "Save" }).click();
      await expect(page.getByRole("dialog")).toBeHidden({ timeout: 10000 });
    }).toPass({ timeout: 20000 });

    await expect(page.getByRole("button", { name: "Jericho" })).toBeVisible({ timeout: 15000 });

    try {
      await page.context().clearCookies();
      await page.goto("/en");
      await openLocationSelector(page);
      const dialog = openLocationDialog(page);
      await dialog.getByLabel("Search for a city or area…").fill("Jericho");
      await expect(dialog.getByRole("button", { name: "Jericho" })).toBeVisible({ timeout: 15000 });
    } finally {
      // Clean up: the location was created purely for this assertion and
      // must not linger in the shared seeded catalog for later runs.
      const snapshot = await db.collection("deliveryLocations").where("slug", "==", "jericho").limit(1).get();
      await Promise.all(snapshot.docs.map((doc) => doc.ref.delete()));
    }
  });
});
