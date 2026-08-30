import { defineConfig, devices } from "@playwright/test";

// `next dev` (spawned below as `webServer`) loads `.env.local` itself, but
// the Playwright test-runner process is a separate process that does not —
// so any spec file's own direct Firebase Admin SDK call (`getTestFirestore`
// in `admin-helpers.ts`, `checkout-invalid.spec.ts`, `tests/e2e/fixtures/
// catalog-reset.ts`, etc.) previously only worked by accident, when the
// shell that happened to invoke `npx playwright test` also happened to
// have `FIRESTORE_EMULATOR_HOST`/`FIREBASE_PROJECT_ID` exported. Loading
// `.env.local` here makes every spec file's Admin SDK access to the
// Firebase Local Emulator Suite deterministic regardless of the invoking
// shell's environment.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", override: true });

// Mobile/tablet/desktop device projects (research.md §14, §18a) so every
// critical flow is verified across the requested device range.
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "mobile-ios", use: { ...devices["iPhone 14"] } },
    { name: "tablet", use: { ...devices["iPad (gen 7)"] } },
    { name: "laptop", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 768 } } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1920, height: 1080 } } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
