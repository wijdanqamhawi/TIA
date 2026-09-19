import { E2E_BASE_URL } from "./emulator-env";
import { test, expect, type Page } from "./fixtures/base";
import { resetSeededStock } from "./fixtures/catalog-reset";
import { loginAsAdmin } from "./admin-helpers";
import { LOCATION_COOKIE_NAME, encodeLocationSelection } from "../../src/lib/domain/delivery/location-selection";

/**
 * Delivery Location end-to-end coverage (T290, quickstart Scenario 14),
 * against the current UI: the storefront has no delivery-location
 * shortcut anywhere (header or phone/tablet menu) — the location is chosen
 * at checkout, through its Region / City fields and its "Change" dialog
 * with bilingual search. A persisted selection (the location cookie,
 * T271) still prefills checkout; admin-managed list changes are reflected
 * immediately with no code change.
 *
 * Requires the Firebase Local Emulator Suite running with
 * `scripts/seed.ts` already applied (seeds the two regions and their
 * cities/areas, including `Ramallah` and `Nablus` under `west-bank` and
 * `Haifa` under `inside-1948`).
 */

const LOCATION_TRIGGER = /Select delivery location|اختاري موقع التوصيل/;

async function getTestFirestore() {
  const { getApps, initializeApp } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  const app = getApps()[0] ?? initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID ?? "demo-elora" });
  return getFirestore(app);
}

/**
 * Persists a location selection exactly as the storefront encodes it
 * (`encodeLocationSelection` into the `elora_location` cookie), looking
 * the location's real id up in the emulator by slug.
 */
async function persistLocation(page: Page, slug: string) {
  const db = await getTestFirestore();
  const snapshot = await db.collection("deliveryLocations").where("slug", "==", slug).limit(1).get();
  const doc = snapshot.docs[0];
  if (!doc) throw new Error(`persistLocation: no seeded delivery location with slug "${slug}".`);
  const value = encodeLocationSelection({
    regionId: doc.get("regionId") as Parameters<typeof encodeLocationSelection>[0]["regionId"],
    locationId: doc.id,
  });
  await page.context().addCookies([
    { name: LOCATION_COOKIE_NAME, value, url: E2E_BASE_URL },
  ]);
}

/** The currently-open native dialog — checkout mounts its own always-present `LocationSelectorDialog`. */
function openLocationDialog(page: Page) {
  return page.locator("dialog[open]");
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

/** Adds a product (checkout needs a non-empty cart) and opens checkout in `locale`. */
async function goToCheckout(page: Page, locale: "en" | "ar" = "en") {
  await addFirstProductToCart(page);
  await page.goto(`/${locale}/checkout`);
  await expect(page.getByLabel(locale === "en" ? "Full Name" : "الاسم الكامل")).toBeVisible({ timeout: 15000 });
}

/** Picks a region, then (once its cities load) a city, through checkout's own fields. */
async function chooseCheckoutLocation(
  page: Page,
  { region, city, regionLabel = "Region", cityLabel = "City / Area" }: { region: string; city: string | number; regionLabel?: string; cityLabel?: string },
) {
  await page.getByLabel(regionLabel).selectOption({ label: region });
  await expect(async () => {
    const options = await page.getByLabel(cityLabel).locator("option").count();
    expect(options).toBeGreaterThan(1);
  }).toPass({ timeout: 10000 });
  await page.getByLabel(cityLabel).selectOption(typeof city === "number" ? { index: city } : { label: city });
}

test.describe("delivery location — checkout", () => {
  test.beforeAll(async () => {
    await resetSeededStock(["golden-bangle-bracelet"]);
  });

  test("the storefront has no delivery-location shortcut — not in the header, the menu or anywhere else", async ({ page }) => {
    await page.goto("/en");
    await expect(page.getByRole("button", { name: LOCATION_TRIGGER })).toHaveCount(0);

    const openMenu = page.getByRole("button", { name: "Open menu" });
    if (await openMenu.isVisible()) {
      await openMenu.click();
      const drawer = page.locator("[data-nav-drawer-open]");
      await expect(drawer).toBeVisible();
      await expect(drawer.getByRole("button", { name: LOCATION_TRIGGER })).toHaveCount(0);
    }
  });

  test("checkout's Region and City fields select a location and show it with a Change control", async ({ page }) => {
    await page.context().clearCookies();
    await goToCheckout(page);

    await chooseCheckoutLocation(page, { region: "West Bank", city: "Ramallah" });
    await expect(page.getByText("Selected: Ramallah")).toBeVisible();
    await expect(page.getByRole("button", { name: "Change" })).toBeVisible();
  });

  test("a persisted location selection prefills checkout, across navigation and reload", async ({ page }) => {
    await page.context().clearCookies();
    await persistLocation(page, "ramallah");
    await goToCheckout(page);

    await expect(page.getByText("Selected: Ramallah")).toBeVisible({ timeout: 15000 });
    await expect(page.getByLabel("Region")).toHaveValue(/.+/);
    await expect(async () => {
      expect(await page.getByLabel("City / Area").inputValue()).not.toBe("");
    }).toPass({ timeout: 10000 });

    await page.goto("/en/shop");
    await page.goto("/en/checkout");
    await expect(page.getByText("Selected: Ramallah")).toBeVisible({ timeout: 15000 });

    await page.reload();
    await expect(page.getByText("Selected: Ramallah")).toBeVisible({ timeout: 15000 });
  });

  test("bilingual search matches an Arabic query in checkout's Change dialog on /ar", async ({ page }) => {
    await page.context().clearCookies();
    await goToCheckout(page, "ar");

    await chooseCheckoutLocation(page, {
      region: "الضفة الغربية",
      city: 1,
      regionLabel: "المنطقة",
      cityLabel: "المدينة / الحي",
    });
    await page.getByRole("button", { name: "تغيير" }).click();
    const dialog = openLocationDialog(page);
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("ابحثي عن مدينة أو حي…").fill("حيفا");
    await dialog.getByRole("button", { name: "حيفا" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("المحدد: حيفا")).toBeVisible();
  });

  test("checkout prefills the persisted location and allows changing it before submitting", async ({ page }) => {
    await page.context().clearCookies();
    await persistLocation(page, "ramallah");
    await goToCheckout(page);

    await expect(page.getByText("Selected: Ramallah")).toBeVisible({ timeout: 15000 });
    await expect(page.getByLabel("Region")).toHaveValue(/.+/);
    await expect(async () => {
      const cityValue = await page.getByLabel("City / Area").inputValue();
      expect(cityValue).not.toBe("");
    }).toPass({ timeout: 10000 });

    // Change the location before submitting — a fresh dialog reopen, not
    // the plain region/city dropdowns, per T279.
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

  test("an admin-added city appears in checkout's location selector with no code change", async ({ page }) => {
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
      await goToCheckout(page);
      await chooseCheckoutLocation(page, { region: "West Bank", city: 1 });
      await page.getByRole("button", { name: "Change" }).click();
      const dialog = openLocationDialog(page);
      await expect(dialog).toBeVisible();
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
