/**
 * E2E safety: every local Playwright run is Firebase-emulator-only.
 *
 * `.env.local` holds the REAL tia-jewllery configuration and is never read
 * here. The E2E environment comes from `.env.emulator` (local) or from the
 * process environment (CI, which sets the emulator variables itself), and
 * `assertEmulatorOnly` refuses to continue unless it unmistakably points at
 * the Firebase Local Emulator Suite with a `demo-*` project — Firebase demo
 * projects cannot reach real Firebase backends at all.
 */
import fs from "node:fs";
import path from "node:path";
import { parse } from "dotenv";

/** Real Firebase project(s) E2E must never target. */
const PRODUCTION_PROJECT_IDS = ["tia-jewllery"];

/** The dedicated E2E Next.js server — never the developer's port-3000 server. */
export const E2E_PORT = 3100;
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;
/** Isolated build directory so the E2E server never shares `.next` with `next dev` on 3000. */
export const E2E_DIST_DIR = ".next-e2e";

/** Production-only variables that must be blank for E2E (no real credentials anywhere). */
const MUST_BE_BLANK = ["FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY", "GOOGLE_APPLICATION_CREDENTIALS"];

const EMULATOR_FILE = ".env.emulator";

function isLocalHost(value: string | undefined): boolean {
  return !!value && /^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(value.trim());
}

/**
 * Builds the E2E environment: `.env.emulator` when present (local), else the
 * current process environment (CI). Keys that only `.env.local` defines are
 * set to "" so Next.js (which only fills *undefined* variables from env
 * files) can never pull a production value into the E2E server.
 */
export function buildE2EEnv(
  root: string,
  base: Record<string, string | undefined> = process.env,
): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(base)) if (typeof value === "string") env[key] = value;

  const emulatorFile = path.join(root, EMULATOR_FILE);
  if (fs.existsSync(emulatorFile)) {
    Object.assign(env, parse(fs.readFileSync(emulatorFile)));
  }

  const localFile = path.join(root, ".env.local");
  if (fs.existsSync(localFile)) {
    const emulatorKeys = fs.existsSync(emulatorFile) ? Object.keys(parse(fs.readFileSync(emulatorFile))) : [];
    for (const key of Object.keys(parse(fs.readFileSync(localFile)))) {
      if (!emulatorKeys.includes(key) && !(key in base)) env[key] = "";
    }
  }

  for (const key of MUST_BE_BLANK) env[key] = "";
  return env;
}

/** Returns every reason this environment is unsafe for E2E (empty = safe). */
export function emulatorProblems(env: Record<string, string | undefined>): string[] {
  const problems: string[] = [];
  if (!isLocalHost(env.FIRESTORE_EMULATOR_HOST)) {
    problems.push("FIRESTORE_EMULATOR_HOST must be set to a local emulator (e.g. 127.0.0.1:8080).");
  }
  if (!isLocalHost(env.FIREBASE_AUTH_EMULATOR_HOST)) {
    problems.push("FIREBASE_AUTH_EMULATOR_HOST must be set to a local emulator (e.g. 127.0.0.1:9099).");
  }
  if (env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS !== "true") {
    problems.push('NEXT_PUBLIC_USE_FIREBASE_EMULATORS must be "true" so the browser SDK also uses the emulator.');
  }
  for (const key of ["FIREBASE_PROJECT_ID", "NEXT_PUBLIC_FIREBASE_PROJECT_ID"]) {
    const value = env[key] ?? "";
    if (!value.startsWith("demo-")) problems.push(`${key} must be a Firebase demo project ("demo-…"), got "${value || "(unset)"}".`);
    if (PRODUCTION_PROJECT_IDS.includes(value)) problems.push(`${key} points at the PRODUCTION project "${value}".`);
  }
  if (env.FIREBASE_PROJECT_ID !== env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
    problems.push("FIREBASE_PROJECT_ID and NEXT_PUBLIC_FIREBASE_PROJECT_ID must be the same demo project.");
  }
  for (const key of MUST_BE_BLANK) {
    if (env[key]) problems.push(`${key} must be empty for E2E (no real credentials).`);
  }
  return problems;
}

/** Throws — aborting the whole run before any test or write — if not emulator-only. */
export function assertEmulatorOnly(env: Record<string, string | undefined>): void {
  const problems = emulatorProblems(env);
  if (problems.length) {
    throw new Error(
      [
        "",
        "E2E SAFETY STOP — refusing to run Playwright outside the Firebase emulator.",
        ...problems.map((problem) => `  • ${problem}`),
        "Nothing was run and nothing was written. Provide the emulator configuration",
        `(${EMULATOR_FILE} locally, or the emulator env vars in CI) and start the emulators.`,
        "",
      ].join("\n"),
    );
  }
}
