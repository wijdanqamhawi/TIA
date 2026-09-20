import path from "node:path";
import { test, expect } from "./fixtures/base";
import { loginAsAdmin, getTestFirestore } from "./admin-helpers";
import { adminRow } from "./fixtures/admin-table";

/**
 * T177 (quickstart Scenario 12 step 5): admin edits a homepage showcase's
 * bilingual title/subtitle/CTA and uploads a new image; the homepage
 * reflects the change without a redeploy.
 */
test.describe("admin — homepage showcase management", () => {
  let cleanupRef: FirebaseFirestore.DocumentReference | null = null;

  test.afterEach(async () => {
    // This test's fixture is `isActive: true` and renders on the real
    // homepage — leaving it behind would corrupt every later test/manual
    // run that loads `/`, so it's cleaned up regardless of pass/fail.
    if (cleanupRef) {
      await cleanupRef.delete();
      cleanupRef = null;
    }
  });

  test("admin edits a showcase's bilingual title and uploads a new desktop image; the homepage hero reflects it live", async ({
    page,
  }) => {
    const db = await getTestFirestore();
    const now = new Date();
    const ref = db.collection("categoryShowcases").doc();
    cleanupRef = ref;
    await ref.set({
      id: ref.id,
      categoryId: "bracelets",
      title: { en: "Original Title", ar: null },
      subtitle: null,
      cta: { en: "Shop Now", ar: null },
      desktopImage: { url: "/brand/logo.svg", storagePath: "showcases/original.png" },
      mobileImage: null,
      // 0, so this showcase is unambiguously the first active one — the
      // homepage hero reads `showcases[0]` (`(storefront)/page.tsx`), and the
      // seeded showcases start at 1.
      displayOrder: 0,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    await loginAsAdmin(page);
    await page.goto("/admin/showcases");

    const newTitle = `Updated Showcase ${Date.now()}`;
    // Seeding already creates a "bracelets" showcase, so more than one row's
    // Category button reads "Bracelets" — scope to the row containing this
    // test's own showcase by its (unique) title text instead. By
    // `admin-row`, not `role=row`: `DataTable` renders a phone card list
    // *and* a table at once (one hidden by a CSS breakpoint), and below
    // `md` there is no table — so there is no row role to find.
    await adminRow(page, "Original Title").getByRole("button").first().click();
    await page.getByLabel("Title — English", { exact: true }).fill(newTitle);
    await page.getByLabel("Title — Arabic", { exact: true }).fill("عنوان محدث");

    const fileInputs = page.locator('input[type="file"]');
    await fileInputs.first().setInputFiles(path.join(__dirname, "fixtures", "test-image.png"));
    await expect(page.getByText("Uploading…").first()).toHaveCount(0, { timeout: 15000 });

    await expect(async () => {
      await page.getByRole("button", { name: "Save" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 10000 });
    }).toPass({ timeout: 20000 });

    // The visible row, not `.last()`: `DataTable` keeps both the phone card
    // and the desktop table in the DOM, so `.last()` picked the one this
    // viewport hides.
    await expect(adminRow(page, newTitle)).toBeVisible();

    const updated = await ref.get();
    expect(updated.data()?.title.en).toBe(newTitle);
    expect(updated.data()?.desktopImage.storagePath).not.toBe("showcases/original.png");

    // The homepage reflects the change without any redeploy. The approved
    // homepage composition doesn't print showcase titles any more; the first
    // active showcase supplies the hero artwork, so the newly uploaded image
    // is what must appear there (directly, or through next/image's
    // encoded `url` parameter).
    const uploadedUrl = updated.data()!.desktopImage.url as string;
    await page.goto("/en");
    await expect(async () => {
      const html = await page.content();
      expect(html.includes(uploadedUrl) || html.includes(encodeURIComponent(uploadedUrl))).toBe(true);
    }).toPass({ timeout: 15000 });
  });
});
