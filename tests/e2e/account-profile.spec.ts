import { test, expect, type Page } from "./fixtures/base";

/**
 * Account profile view/update end-to-end coverage (spec User Story 2,
 * this task's explicit "view and update approved profile information"
 * requirement): a registered customer can see and update her name,
 * phone, and saved delivery address, and the change persists across a
 * reload. Requires the Firebase Local Emulator Suite running with
 * `scripts/seed.ts` already applied.
 */

const PASSWORD = "supersecret123";

async function registerNewCustomer(page: Page, name: string, emailPrefix: string): Promise<string> {
  let attempt = 0;
  let email = "";
  await expect(async () => {
    attempt += 1;
    email = `${emailPrefix}-attempt${attempt}@example.com`;
    await page.goto("/en/register");
    await page.getByLabel("Full Name").fill(name);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Create Account" }).click();
    await expect(page).not.toHaveURL(/\/register/, { timeout: 15000 });
  }).toPass({ timeout: 30000 });
  return email;
}

test.describe("account profile", () => {
  test("registered customer can view and update her profile, including a saved delivery address", async ({
    page,
  }) => {
    const email = await registerNewCustomer(page, "Profile Tester", `profile-${Date.now()}`);

    await page.goto("/en/account");
    await expect(page.getByLabel("Full Name")).toHaveValue("Profile Tester");
    await expect(page.getByLabel("Email")).toHaveValue(email);
    await expect(page.getByLabel("Email")).toBeDisabled();

    await page.getByLabel("Full Name").fill("Updated Name");
    await page.getByLabel("Mobile Phone Number").fill("+970599123456");
    await page.getByLabel("Region").selectOption({ label: "West Bank" });
    await expect(async () => {
      const options = await page.getByLabel("City / Area").locator("option").count();
      expect(options).toBeGreaterThan(1);
    }).toPass({ timeout: 10000 });
    await page.getByLabel("City / Area").selectOption({ index: 1 });
    await page.getByLabel("Full Address").fill("456 Updated Street");

    await expect(async () => {
      await page.getByRole("button", { name: "Save Changes" }).click();
      await expect(page.getByText("Profile updated.")).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 15000 });

    // Persists across a reload.
    await page.reload();
    await expect(page.getByLabel("Full Name")).toHaveValue("Updated Name");
    await expect(page.getByLabel("Mobile Phone Number")).toHaveValue("+970599123456");
    await expect(page.getByLabel("Full Address")).toHaveValue("456 Updated Street");
  });

  test("a guest visiting /account is redirected to login", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/en/account");
    await expect(page).toHaveURL(/\/login\?next=/);
  });

  test("Arabic account page renders localized labels in RTL", async ({ page }) => {
    await registerNewCustomer(page, "Arabic Profile Tester", `ar-profile-${Date.now()}`);
    await page.goto("/ar/account");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "حسابي", level: 1 })).toBeVisible();
  });
});
