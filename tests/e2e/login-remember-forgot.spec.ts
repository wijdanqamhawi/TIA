import { test, expect, type Page } from "./fixtures/base";
import { loginAsAdmin, registerNewCustomer } from "./admin-helpers";

/**
 * Customer login conveniences: the login form remembers the customer's EMAIL
 * (only) across logout and browser restarts, and "Forgot password?" starts
 * Firebase's reset-email flow without revealing which emails have accounts.
 * Admin sign-in and the separate __admin_session cookie are untouched.
 */

const CUSTOMER_PASSWORD = "supersecret123";
const STORAGE_KEY = "tia:customer-login-email";

async function signInThroughForm(page: Page, email: string) {
  await page.goto("/en/login");
  await expect(async () => {
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(CUSTOMER_PASSWORD);
    await expect(page.getByLabel("Email")).toHaveValue(email);
    await expect(page.getByLabel("Password")).toHaveValue(CUSTOMER_PASSWORD);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });
  }).toPass({ timeout: 60000 });
}

async function logout(page: Page) {
  await page.goto("/en/account");
  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL(/\/en\/login$/, { timeout: 20000 });
  await page.waitForLoadState("networkidle");
}

test.describe("remember customer email", () => {
  test("prefills the email after logout and reload, and never keeps the password", async ({ page, context }) => {
    const email = await registerNewCustomer(page, "Remember Tester", `remember-${Date.now()}`);
    await logout(page);

    // Nothing remembered yet: registering is not a login.
    await page.goto("/en/login");
    await expect(page.getByLabel("Email")).toHaveValue("");

    await signInThroughForm(page, email);
    await logout(page);

    // After logout the login page offers the same email, and the password field is empty.
    await expect(page.getByLabel("Email")).toHaveValue(email);
    await expect(page.getByLabel("Password")).toHaveValue("");

    // Survives a refresh and a brand-new tab in the same browser profile.
    await page.reload();
    await expect(page.getByLabel("Email")).toHaveValue(email);
    const reopened = await context.newPage();
    await reopened.goto("/en/login");
    await expect(reopened.getByLabel("Email")).toHaveValue(email);
    await expect(reopened.getByLabel("Password")).toHaveValue("");

    // Only the email is stored, and no session cookie carries it.
    const stored = await page.evaluate(() => ({ ...window.localStorage }));
    expect(stored).toEqual({ [STORAGE_KEY]: email });
    expect(JSON.stringify(stored)).not.toContain(CUSTOMER_PASSWORD);
    const session = await page.evaluate(() => JSON.stringify({ ...window.sessionStorage }));
    expect(session).not.toContain(CUSTOMER_PASSWORD);
    expect(session).not.toContain(email);
    const cookies = await context.cookies();
    expect(JSON.stringify(cookies)).not.toContain(CUSTOMER_PASSWORD);
    expect(cookies.some((c) => c.name === "__admin_session")).toBe(false);
  });

  test("works on the Arabic login page too", async ({ page }) => {
    const email = await registerNewCustomer(page, "Remember AR", `remember-ar-${Date.now()}`);
    await logout(page);
    await signInThroughForm(page, email);
    await logout(page);

    await page.goto("/ar/login");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("#email")).toHaveValue(email);
    await expect(page.locator("#password")).toHaveValue("");
  });

  test("an admin signing in leaves no admin email on the customer login page", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAsAdmin(page);

    expect(await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY)).toBeNull();
    await page.goto("/en/login");
    await expect(page.getByLabel("Email")).toHaveValue("");
    // The admin session is still its own cookie, not the customer one.
    const names = (await context.cookies()).map((c) => c.name);
    expect(names).toContain("__admin_session");
    expect(names).not.toContain("__session");
    await context.close();
  });
});

test.describe("forgot password", () => {
  test("the login page links to a reset form that confirms neutrally for any email", async ({ page }) => {
    await page.goto("/en/login");
    await page.getByRole("link", { name: "Forgot password?" }).click();
    // Generous: the first visit compiles the route on the dev server.
    await expect(page).toHaveURL(/\/en\/forgot-password$/, { timeout: 45000 });
    await expect(page.getByRole("heading", { name: "Reset Your Password" })).toBeVisible();

    // An invalid address is rejected on the page.
    await page.getByLabel("Email").fill("not-an-email");
    await page.getByRole("button", { name: "Send Reset Link" }).click();
    await expect(page.locator("#forgot-error")).toHaveText("Enter a valid email address.");

    // An address with no account gets the same confirmation as a real one.
    await page.getByLabel("Email").fill(`nobody-${Date.now()}@example.com`);
    await page.getByRole("button", { name: "Send Reset Link" }).click();
    await expect(page.getByTestId("reset-sent")).toContainText("If an account exists for that email");

    await page.getByRole("link", { name: "Back to sign in" }).click();
    await expect(page).toHaveURL(/\/en\/login$/);
  });

  test("a registered email gets the identical confirmation", async ({ page }) => {
    const email = await registerNewCustomer(page, "Reset Tester", `reset-${Date.now()}`);
    await logout(page);

    await page.goto("/en/forgot-password");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send Reset Link" }).click();
    await expect(page.getByTestId("reset-sent")).toContainText("If an account exists for that email");
  });

  test("renders in Arabic, right-to-left", async ({ page }) => {
    await page.goto("/ar/login");
    await page.getByRole("link", { name: "نسيت كلمة المرور؟" }).click();
    await expect(page).toHaveURL(/\/ar\/forgot-password$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "إعادة تعيين كلمة المرور" })).toBeVisible();

    await page.locator("#email").fill(`nobody-${Date.now()}@example.com`);
    await page.getByRole("button", { name: "إرسال رابط إعادة التعيين" }).click();
    await expect(page.getByTestId("reset-sent")).toContainText("إذا كان هناك حساب");
  });
});
