import { expect, type Page } from "@playwright/test";

/** Shared helpers for the Phase 10 admin e2e suite (T175–T179). */

export async function getTestFirestore() {
  const { getApps, initializeApp } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  const app = getApps()[0] ?? initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID ?? "demo-elora" });
  return getFirestore(app);
}

const ADMIN_EMAIL = process.env.ADMIN_BOOTSTRAP_EMAIL ?? "admin@elora.local";
const ADMIN_PASSWORD = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? "DevAdminPass123";

/** Signs in as the seeded admin account (`npm run create-admin`) and lands on `/admin`. */
export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto("/en/login?next=/admin");
  await expect(async () => {
    // The login form's inputs are React-controlled (`value={email}`,
    // initial state ""). If `.fill()` writes to the DOM before hydration
    // attaches the input's `onChange`, the completing hydration re-renders
    // with the still-"" state and silently wipes the value back out —
    // observed intermittently on the `tablet` Playwright project, whose
    // hydration timing apparently loses this race more often than others.
    // Re-verifying (and, via `.toPass()`, re-filling on failure) closes
    // that window without touching the production form at all.
    await page.getByLabel("Email").fill(ADMIN_EMAIL);
    await page.getByLabel("Password").fill(ADMIN_PASSWORD);
    await expect(page.getByLabel("Email")).toHaveValue(ADMIN_EMAIL);
    await expect(page.getByLabel("Password")).toHaveValue(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign In" }).click();
    // Generous: `/admin` compiling for the first time in dev mode after a
    // fresh build can legitimately take longer than a typical route (it's
    // often the first project/spec in a run to ever touch it). A short
    // inner timeout here doesn't make this safer — it makes it actively
    // worse: the retry re-clicks "Sign In" while the still-compiling
    // `/admin` request is in flight, which aborts it and restarts the
    // whole cold-compile from zero, so a slow-but-succeeding first
    // attempt can never finish before the outer budget runs out. Give
    // the one real attempt enough room to actually land.
    await expect(page).toHaveURL(/\/admin$/, { timeout: 45000 });
  }).toPass({ timeout: 60000 });
  // The admin redirect is a full `window.location` navigation (not the
  // SPA router) — wait for it to fully settle before the caller issues
  // another `page.goto`, or that next navigation can race the in-flight
  // one and abort with ERR_ABORTED.
  await page.waitForLoadState("load");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({ timeout: 30000 });
}

const CUSTOMER_PASSWORD = "supersecret123";

/** Registers a brand-new registered customer and returns her email — for admin-authz negative tests. */
export async function registerNewCustomer(page: Page, name: string, emailPrefix: string): Promise<string> {
  let attempt = 0;
  let email = "";
  await expect(async () => {
    attempt += 1;
    email = `${emailPrefix}-attempt${attempt}@example.com`;
    await page.goto("/en/register");
    // `.toHaveValue()` here fails fast with a clear "which field, what was
    // in it" message rather than the opaque "still on /register" the
    // caller used to see. NOTE (2026-08-30): on `mobile-ios`/`tablet`
    // specifically, "Full Name" has been observed to land and *stay*
    // empty across the full retry budget below — reproduced against this
    // exact, unmodified function from an unrelated spec
    // (`admin-authz.spec.ts`), so this is a genuine pre-existing
    // WebKit-project gap in this shared helper, not something introduced
    // by whatever spec is calling it. Left open rather than chased further
    // here — same class of documented, out-of-scope test-currency gap as
    // `delivery-location.spec.ts`'s mobile-ios install-prompt note.
    await page.getByLabel("Full Name").fill(name);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(CUSTOMER_PASSWORD);
    await expect(page.getByLabel("Full Name")).toHaveValue(name);
    await expect(page.getByLabel("Email")).toHaveValue(email);
    await expect(page.getByLabel("Password")).toHaveValue(CUSTOMER_PASSWORD);
    await page.getByRole("button", { name: "Create Account" }).click();
    await expect(page).not.toHaveURL(/\/register/, { timeout: 15000 });
  }).toPass({ timeout: 60000 });
  return email;
}
