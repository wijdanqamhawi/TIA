import { FieldValue } from "firebase-admin/firestore";
import { openShopFilters } from "./fixtures/shop-filters";
import { test, expect } from "./fixtures/base";
import { getTestFirestore } from "./admin-helpers";
import { buildSearchTerms } from "../../src/lib/utils/searchTokens";

/**
 * T245 (quickstart Scenario 13 steps 4-5, spec FR-074): bilingual
 * product/category content.
 *
 * The seeded TIA catalog (scripts/seed.ts) is fully bilingual — every
 * product carries real Arabic copy — so the Arabic storefront must show
 * that Arabic copy. The Arabic→English fallback for a product that has no
 * translation (`resolveLocalizedString`, src/types/localizedString.ts) is
 * still a supported case (admins may save English-only products), so this
 * file inserts its own English-only product into the emulator for those
 * assertions and removes it afterwards. The four category names must render
 * correctly in Arabic wherever a category name is shown.
 */

/** A dedicated English-only fixture product (never part of the seed). */
const ENGLISH_ONLY = {
  id: "e2e-english-only-bangle",
  slug: "e2e-english-only-bangle",
  name: "Northern Lights Bangle",
  material: "Hammered Sterling Silver",
  description: "A hammered silver bangle with no Arabic translation yet.",
} as const;

test.describe("bilingual catalog content", () => {
  test("a seeded product shows its own Arabic name, material and description on the Arabic product page", async ({
    page,
  }) => {
    await page.goto("/ar/shop/pearl-tennis-bracelet");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    await expect(page.getByRole("heading", { name: "طقم خواتم لؤلؤ وفيروز", level: 1 })).toBeVisible();
    await expect(page.getByText("لؤلؤ طبيعي وفيروز وفضة إسترليني")).toBeVisible();
    await expect(page.getByText("طقم من الخواتم الرفيعة يجمع بين اللؤلؤ الطبيعي وأحجار الفيروز.")).toBeVisible();
    // The Arabic page never falls back to the English copy when a translation exists.
    await expect(page.getByRole("heading", { name: "Pearl & Turquoise Ring Set", level: 1 })).toHaveCount(0);
  });

  test("all four category names display correctly in Arabic", async ({ page }) => {
    // The Shop page filters by category in place: its category controls are
    // buttons in the filter panel — the sidebar from `lg` up, and the same
    // control inside the drawer below it, which is portalled to <body>
    // rather than rendered inside <main>. So this asserts page-wide, after
    // making whichever one this viewport uses reachable.
    await page.goto("/ar/shop");
    await openShopFilters(page);
    for (const name of ["أساور", "خواتم", "أقراط", "ساعات"]) {
      await expect(page.getByRole("button", { name, exact: true }).first()).toBeVisible();
    }

    const main = page.getByRole("main");

    // The dedicated category route's own category navigation links.
    await page.goto("/ar/shop/category/rings");
    await expect(main.getByRole("heading", { name: "خواتم", level: 1 })).toBeVisible();
    for (const name of ["أساور", "خواتم", "أقراط", "ساعات"]) {
      await expect(main.getByRole("link", { name, exact: true })).toBeVisible();
    }
  });

  test("all four category names display correctly in Arabic on the homepage", async ({ page }) => {
    await page.goto("/ar");
    await expect(page.getByRole("main").getByRole("link", { name: "أساور", exact: true })).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: "خواتم", exact: true })).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: "أقراط", exact: true })).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: "ساعات", exact: true })).toBeVisible();
  });

  test.describe("a product with no Arabic translation", () => {
    // One worker for the whole group: the fixture product is created once
    // and deleted once, never while a sibling test still needs it.
    test.describe.configure({ mode: "serial" });

    test.beforeAll(async () => {
      const db = await getTestFirestore();
      await db
        .collection("products")
        .doc(ENGLISH_ONLY.id)
        .set({
          id: ENGLISH_ONLY.id,
          name: { en: ENGLISH_ONLY.name, ar: null },
          slug: ENGLISH_ONLY.slug,
          description: { en: ENGLISH_ONLY.description, ar: null },
          price: 12000,
          categoryId: "bracelets",
          images: [
            {
              url: "/brand/logo.svg",
              storagePath: `e2e/products/${ENGLISH_ONLY.slug}.svg`,
              position: 0,
              alt: ENGLISH_ONLY.name,
              valueKey: null,
            },
          ],
          material: { en: ENGLISH_ONLY.material, ar: null },
          options: [],
          stock: 5,
          availability: true,
          isNewArrival: false,
          isBestSeller: false,
          salesCount: 0,
          isOnSale: false,
          salePrice: null,
          saleStartAt: null,
          saleEndAt: null,
          searchTerms: buildSearchTerms(ENGLISH_ONLY.name, null, "Bracelets", "أساور"),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
    });

    test.afterAll(async () => {
      const db = await getTestFirestore();
      await db.collection("products").doc(ENGLISH_ONLY.id).delete();
    });

    test("falls back to its English text on the Arabic product page", async ({ page }) => {
      await page.goto(`/ar/shop/${ENGLISH_ONLY.slug}`);
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

      // Falls back to the real English name/material/description — never
      // blank, never the literal string "null"/"undefined".
      await expect(page.getByRole("heading", { name: ENGLISH_ONLY.name, level: 1 })).toBeVisible();
      await expect(page.getByText(ENGLISH_ONLY.material)).toBeVisible();
      await expect(page.getByText(ENGLISH_ONLY.description)).toBeVisible();

      const bodyText = await page.locator("body").innerText();
      expect(bodyText).not.toContain("null");
      expect(bodyText).not.toContain("undefined");
    });

    test("still shows its real English name in the Arabic category listing", async ({ page }) => {
      await page.goto("/ar/shop/category/bracelets");
      await expect(page.getByRole("main").getByText(ENGLISH_ONLY.name).first()).toBeVisible();
    });
  });
});
