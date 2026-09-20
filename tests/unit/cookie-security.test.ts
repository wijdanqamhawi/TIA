import { describe, expect, it } from "vitest";
import { cookieSecure, isEmulatorE2EServer } from "@/lib/config/cookies";

/**
 * The E2E cookie-security override, and the reasons it cannot leak into a
 * real deployment.
 *
 * The suite serves a production build over plain HTTP on port 3100, so
 * `NODE_ENV` is `"production"` while the origin is not secure. WebKit
 * discards `Secure` cookies on such an origin (Chromium quietly accepts
 * them on `localhost`, which is why this only ever showed up on
 * `mobile-ios` and `tablet`). `cookieSecure` therefore has exactly one
 * exception — and it is gated on proof of an emulator-only demo project,
 * never on `NODE_ENV` alone.
 */

/** A real deployment: HTTPS, real project, real credentials, no emulators. */
const PRODUCTION: NodeJS.ProcessEnv = {
  NODE_ENV: "production",
  FIREBASE_PROJECT_ID: "tia-jewllery",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "tia-jewllery",
  NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "false",
  FIREBASE_CLIENT_EMAIL: "service-account@tia-jewllery.iam.gserviceaccount.com",
  FIREBASE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----…",
};

/** The isolated Playwright server: production build, emulators, demo project, plain HTTP. */
const E2E: NodeJS.ProcessEnv = {
  NODE_ENV: "production",
  E2E_INSECURE_COOKIES: "true",
  FIREBASE_PROJECT_ID: "demo-elora",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-elora",
  NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "true",
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  FIREBASE_CLIENT_EMAIL: "",
  FIREBASE_PRIVATE_KEY: "",
};

describe("cookieSecure", () => {
  it("marks cookies Secure in production", () => {
    expect(cookieSecure(PRODUCTION)).toBe(true);
  });

  it("does not mark cookies Secure on the isolated emulator E2E server", () => {
    expect(cookieSecure(E2E)).toBe(false);
  });

  it("does not mark cookies Secure in development, exactly as before", () => {
    expect(cookieSecure({ NODE_ENV: "development" })).toBe(false);
  });

  it("keeps cookies Secure in production even when the E2E flag is set", () => {
    // The flag alone proves nothing — this is the case that matters most:
    // a stray environment variable in a real deployment must be inert.
    expect(cookieSecure({ ...PRODUCTION, E2E_INSECURE_COOKIES: "true" })).toBe(true);
    expect(isEmulatorE2EServer({ ...PRODUCTION, E2E_INSECURE_COOKIES: "true" })).toBe(false);
  });

  it("never lets the production project id activate the override, however the rest is configured", () => {
    // Everything an attacker or a mistake could copy from the E2E setup,
    // with the real project left in place.
    for (const key of ["FIREBASE_PROJECT_ID", "NEXT_PUBLIC_FIREBASE_PROJECT_ID"] as const) {
      expect(cookieSecure({ ...E2E, [key]: "tia-jewllery" })).toBe(true);
    }
  });
});

describe("isEmulatorE2EServer — every condition is necessary", () => {
  it("is true only for the complete emulator-only configuration", () => {
    expect(isEmulatorE2EServer(E2E)).toBe(true);
  });

  it.each([
    ["the opt-in flag", { E2E_INSECURE_COOKIES: undefined }],
    ["a demo server project", { FIREBASE_PROJECT_ID: "tia-prod" }],
    ["a demo browser project", { NEXT_PUBLIC_FIREBASE_PROJECT_ID: "tia-prod" }],
    ["browser-side emulators", { NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "false" }],
    ["a local Firestore emulator", { FIRESTORE_EMULATOR_HOST: "firestore.example.com:443" }],
    ["a local Auth emulator", { FIREBASE_AUTH_EMULATOR_HOST: undefined }],
    ["no Admin client email", { FIREBASE_CLIENT_EMAIL: "real@example.iam.gserviceaccount.com" }],
    ["no Admin private key", { FIREBASE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----…" }],
    ["no application-default credentials", { GOOGLE_APPLICATION_CREDENTIALS: "/secrets/key.json" }],
  ])("is false without %s", (_condition, override) => {
    const env = { ...E2E, ...override } as NodeJS.ProcessEnv;
    expect(isEmulatorE2EServer(env)).toBe(false);
    expect(cookieSecure(env)).toBe(true);
  });
});
