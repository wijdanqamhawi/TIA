import { defineConfig, devices } from "@playwright/test";
import { assertEmulatorOnly, buildE2EEnv, E2E_BASE_URL, E2E_DIST_DIR, E2E_PORT } from "./tests/e2e/emulator-env";

/**
 * Whether to serve the suite from a real production server rather than
 * `next dev`.
 *
 * On CI, always. `next dev` compiles each route on first request and runs
 * the development image optimizer, and in run 35519263633 that optimizer
 * wedged on one cache key —
 * `/_next/image?url=/images/demo/splash-model-desktop-lit.jpg&w=2048&q=75`,
 * the srcset candidate only the iPad viewport asks for. It never answered
 * again, so every subsequent `page.goto('/en')` on the `tablet` project
 * waited forever for `load` and timed out: 11 failures, not one of them an
 * assertion. The same dev server later hit its memory ceiling, restarted,
 * and left a truncated JSON cache behind. None of that exists in
 * `next build && next start`, which also removes the per-route compile
 * that the suite's timeouts were inflated to absorb.
 *
 * Locally the default stays `next dev`, because rebuilding for every run
 * would make iterating on a single spec far slower. Set
 * `E2E_PRODUCTION_SERVER=true` to reproduce CI's setup exactly.
 */
const useProductionServer = !!process.env.CI || process.env.E2E_PRODUCTION_SERVER === "true";

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
  // The E2E server is `next dev`, not a production build, and these specs
  // are whole journeys: an admin sign-in plus half a dozen navigations, a
  // registration plus a real checkout, an .xlsx generated on demand. Even
  // with the route warm-up in `global-setup.ts`, Playwright's 30s default
  // is a budget several of those cannot make on a cold module graph — and
  // a timeout there is a slow machine, not a broken storefront. 90s is
  // generous enough that a failure means something is genuinely wrong,
  // while still bounding a hang.
  timeout: 120_000,
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
    //
    // Both the build and the server it serves inherit `env` below, so the
    // production bundle is compiled with the emulator configuration — which
    // is what `global-setup.ts` then re-verifies by reading the served
    // JavaScript. `NEXT_DIST_DIR` keeps that build in `.next-e2e`, never in
    // the `.next` a developer's own `next dev`/`next start` on port 3000 is
    // using.
    command: useProductionServer
      ? `npx next build && npx next start -p ${E2E_PORT}`
      : `npx next dev -p ${E2E_PORT}`,
    url: E2E_BASE_URL,
    reuseExistingServer: false,
    // A production build is minutes of work before the server can listen;
    // `next dev` listens immediately.
    timeout: useProductionServer ? 900_000 : 180_000,
    env: {
      ...e2eEnv,
      NEXT_DIST_DIR: E2E_DIST_DIR,
      // `next start` means NODE_ENV=production, so every session and
      // guest-cart cookie would be issued `Secure` — and this server is
      // plain HTTP. Chromium accepts `Secure` cookies on localhost; WebKit
      // refuses them, which cost 114 tests in run 35529297026. The flag is
      // only honoured alongside independent proof of an emulator-only
      // demo-project environment (see lib/config/cookies.ts), so it cannot
      // weaken a real deployment.
      E2E_INSECURE_COOKIES: "true",
    },
  },
});
