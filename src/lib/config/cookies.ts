/**
 * Whether cookies this app sets must carry the `Secure` attribute.
 *
 * Production always gets `Secure`. The single exception exists because the
 * E2E suite serves a *production build* (`next build && next start`) over
 * plain `http://localhost:3100` — `NODE_ENV` is therefore `"production"`,
 * so every session and guest-cart cookie was issued `Secure` and simply
 * discarded by the browser. Chromium hides this by treating `localhost` as
 * a trustworthy origin and accepting `Secure` cookies there; WebKit does
 * not, which is why CI run 35529297026 failed 114 tests across
 * `mobile-ios` and `tablet` alone — no session, no cart, an endless
 * login → /admin → login bounce.
 *
 * Rather than key the exception off `NODE_ENV` (which is exactly what real
 * production sets), it requires an explicit opt-in flag **and** independent
 * proof that the process is talking to the Firebase Local Emulator Suite
 * with a demo project. Every condition below must hold; a real deployment
 * satisfies none of them, and setting the flag alone achieves nothing.
 */

/** Real Firebase project(s) that must never be able to turn `Secure` off. */
const PRODUCTION_PROJECT_IDS = ["tia-jewllery"];

/** The opt-in, set only by `playwright.config.ts` for its own isolated server. */
const E2E_FLAG = "E2E_INSECURE_COOKIES";

function isLocalEmulatorHost(value: string | undefined): boolean {
  return !!value && /^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(value.trim());
}

/**
 * True only for the isolated, emulator-backed E2E server described above.
 *
 * Exported for the guard tests, which assert both that this is false for a
 * production configuration and that no production configuration — even one
 * with the flag set — can make it true.
 */
export function isEmulatorE2EServer(env: NodeJS.ProcessEnv = process.env): boolean {
  // 1. The explicit opt-in. Necessary, and on its own not sufficient.
  if (env[E2E_FLAG] !== "true") return false;

  // 2. Both project ids must be Firebase demo projects, which cannot reach
  //    real Firebase backends at all, and neither may be a known real one.
  const projectIds = [env.FIREBASE_PROJECT_ID ?? "", env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? ""];
  if (projectIds.some((id) => !id.startsWith("demo-") || PRODUCTION_PROJECT_IDS.includes(id))) return false;

  // 3. The browser SDK must be pointed at the emulators too.
  if (env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS !== "true") return false;

  // 4. Firestore and Auth must both be local emulators.
  if (!isLocalEmulatorHost(env.FIRESTORE_EMULATOR_HOST)) return false;
  if (!isLocalEmulatorHost(env.FIREBASE_AUTH_EMULATOR_HOST)) return false;

  // 5. No real Admin credentials anywhere in the process.
  if (env.FIREBASE_CLIENT_EMAIL || env.FIREBASE_PRIVATE_KEY || env.GOOGLE_APPLICATION_CREDENTIALS) return false;

  return true;
}

/**
 * The `secure` flag for every cookie this app sets.
 *
 * Read at call time, never at module load, so a test can vary the
 * environment without depending on import order.
 */
export function cookieSecure(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NODE_ENV !== "production") return false;
  return !isEmulatorE2EServer(env);
}
