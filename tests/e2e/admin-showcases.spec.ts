import path from "node:path";
import { test, expect } from "./fixtures/base";
import { loginAsAdmin, getTestFirestore } from "./admin-helpers";

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

  test("admin edits a showcase's bilingual title and uploads a new desktop image; the homepage reflects it live", async ({
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
      displayOrder: 1,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    await loginAsAdmin(page);
    await page.goto("/admin/showcases");

    const newTitle = `Updated Showcase ${Date.now()}`;
    // Seeding already creates a "bracelets" showcase, so more than one row's
    // Category button reads "Bracelets" — scope to the row containing this
    // test's own showcase by its (unique) title text instead.
    await page.getByRole("row").filter({ hasText: "Original Title" }).getByRole("button").click();
    await page.getByLabel("Title — English", { exact: true }).fill(newTitle);
    await page.getByLabel("Title — Arabic", { exact: true }).fill("عنوان محدث");

    const fileInputs = page.locator('input[type="file"]');
    await fileInputs.first().setInputFiles(path.join(__dirname, "fixtures", "test-image.png"));
    await expect(page.getByText("Uploading…").first()).toHaveCount(0, { timeout: 15000 });

    await expect(async () => {
      await page.getByRole("button", { name: "Save" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 10000 });
    }).toPass({ timeout: 20000 });

    await expect(page.getByText(newTitle).last()).toBeVisible();

    const updated = await ref.get();
    expect(updated.data()?.title.en).toBe(newTitle);
    expect(updated.data()?.desktopImage.storagePath).not.toBe("showcases/original.png");

    // The homepage reflects the change without any redeploy.
    await page.goto("/en");
    await expect(page.getByText(newTitle)).toBeVisible({ timeout: 10000 });
  });
});
