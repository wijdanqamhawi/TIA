import { defineConfig, devices } from "@playwright/test";
import { assertEmulatorOnly, buildE2EEnv, E2E_BASE_URL, E2E_DIST_DIR, E2E_PORT } from "./tests/e2e/emulator-env";

// E2E is Firebase-emulator-only. `.env.local` now holds the REAL
// tia-jewllery configuration, so it is never loaded here: the environment
// comes from `.env.emulator` (local) or from the CI job's emulator variables,
// and `assertEmulatorOnly` aborts the whole run — before any test, fixture
// or Admin SDK write — unless it unmistakably targets the emulators with a
// `demo-*` project. The resolved values are also applied to this runner
// process, so every spec's direct Firebase Admin SDK access
// (`admin-helpers.ts`, `fixtures/catalog-reset.ts`, …) uses the emulator.
const e2eEnv = buildE2EEnv(__dirname);
assertEmulatorOnly(e2eEnv);
Object.assign(process.env, e2eEnv);

// Mobile/tablet/desktop device projects (research.md §14, §18a) so every
// critical flow is verified across the requested device range.
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    // Always the dedicated emulator-backed E2E server — never the
    // developer's own port-3000 server, which may be production-configured.
    baseURL: E2E_BASE_URL,
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
    // Its own server on its own port and build directory, started with the
    // emulator environment only. Never reused: if something else already
    // holds the port, the run fails instead of testing against it.
    command: `npx next dev -p ${E2E_PORT}`,
    url: E2E_BASE_URL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { ...e2eEnv, NEXT_DIST_DIR: E2E_DIST_DIR },
  },
});
