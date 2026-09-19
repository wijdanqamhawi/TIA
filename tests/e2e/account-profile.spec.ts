import { test, expect, type Page } from "./fixtures/base";

/**
 * Account profile view/update end-to-end coverage (spec User Story 2),
 * for the compact My Account design: a registered customer can see and
 * update her name, phone and optional date of birth (email stays
 * read-only), the change persists across a reload, the account tabs and
 * support link reach their real routes, and Logout ends the session.
 * The saved delivery address is not edited on this page. Requires the
 * Firebase Local Emulator Suite running with `scripts/seed.ts` applied.
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

async function saveAndExpectSuccess(page: Page) {
  await expect(async () => {
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByText("Profile updated.")).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 15000 });
}

test.describe("account profile", () => {
  // Each test registers a fresh account and then makes several page visits;
  // against `next dev` (routes compile on first request) that legitimately
  // exceeds the default 30s per-test budget.
  test.describe.configure({ timeout: 90_000 });

  test("registered customer can view and update her profile, including an optional date of birth", async ({
    page,
  }) => {
    const email = await registerNewCustomer(page, "Profile Tester", `profile-${Date.now()}`);

    await page.goto("/en/account");
    await expect(page.getByRole("heading", { name: "My Account", level: 1 })).toBeVisible();
    await expect(page.getByLabel("Full Name")).toHaveValue("Profile Tester");
    await expect(page.getByLabel("Email Address")).toHaveValue(email);
    await expect(page.getByLabel("Email Address")).toBeDisabled();
    await expect(page.getByLabel("Date of Birth")).toHaveValue("");

    await page.getByLabel("Full Name").fill("Updated Name");
    await page.getByLabel("Mobile Phone Number").fill("+970599123456");
    // The date field masks digits into DD/MM/YYYY as they are typed.
    await page.getByLabel("Date of Birth").pressSequentially("21031994");
    await expect(page.getByLabel("Date of Birth")).toHaveValue("21/03/1994");

    await saveAndExpectSuccess(page);

    // Persists across a reload.
    await page.reload();
    await expect(page.getByLabel("Full Name")).toHaveValue("Updated Name");
    await expect(page.getByLabel("Mobile Phone Number")).toHaveValue("+970599123456");
    await expect(page.getByLabel("Date of Birth")).toHaveValue("21/03/1994");
    await expect(page.getByLabel("Email Address")).toHaveValue(email);

    // Clearing the optional date of birth is saved too.
    await page.getByLabel("Date of Birth").fill("");
    await saveAndExpectSuccess(page);
    await page.reload();
    await expect(page.getByLabel("Date of Birth")).toHaveValue("");
  });

  test("an impossible date of birth is rejected and nothing is saved", async ({ page }) => {
    await registerNewCustomer(page, "Date Tester", `dob-${Date.now()}`);
    await page.goto("/en/account");

    await page.getByLabel("Date of Birth").pressSequentially("31021994");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByText("Enter a valid date of birth")).toBeVisible();
    await expect(page.getByText("Profile updated.")).toHaveCount(0);

    await page.reload();
    await expect(page.getByLabel("Date of Birth")).toHaveValue("");
  });

  test("account tabs and the support link reach their real routes", async ({ page }) => {
    await registerNewCustomer(page, "Tabs Tester", `tabs-${Date.now()}`);
    await page.goto("/en/account");

    const nav = page.getByRole("navigation", { name: "Account sections" });
    await expect(nav.getByRole("link", { name: /My Profile/ })).toHaveAttribute("aria-current", "page");

    // Client-side navigation; a route's first visit compiles it under `next dev`.
    await nav.getByRole("link", { name: /Order History/ }).click();
    await expect(page).toHaveURL(/\/en\/account\/orders$/, { timeout: 20000 });

    await page.goto("/en/account");
    await nav.getByRole("link", { name: /My Wishlist/ }).click();
    await expect(page).toHaveURL(/\/en\/wishlist$/, { timeout: 20000 });

    await page.goto("/en/account");
    await page.getByRole("link", { name: "Contact our support team" }).click();
    await expect(page).toHaveURL(/\/en\/contact$/, { timeout: 20000 });
  });

  test("Logout ends the session and protects the account page again", async ({ page }) => {
    await registerNewCustomer(page, "Logout Tester", `logout-${Date.now()}`);
    await page.goto("/en/account");

    await page.getByRole("button", { name: "Logout" }).click();
    await expect(page).toHaveURL(/\/en\/login$/, { timeout: 20000 });
    // Logout replaces the URL and then refreshes; let that settle before navigating again.
    await page.waitForLoadState("networkidle");
    expect((await page.context().cookies()).some((cookie) => cookie.name === "__session")).toBe(false);

    await page.goto("/en/account");
    await expect(page).toHaveURL(/\/login\?next=/);
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
    await expect(page.getByLabel("الاسم الكامل")).toHaveValue("Arabic Profile Tester");
    await expect(page.getByLabel("تاريخ الميلاد")).toBeVisible();
    await expect(page.getByRole("button", { name: "حفظ التغييرات" })).toBeVisible();
    await expect(page.getByRole("button", { name: "تسجيل الخروج" })).toBeVisible();
  });
});
