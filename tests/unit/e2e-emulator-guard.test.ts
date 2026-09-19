// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { assertEmulatorOnly, buildE2EEnv, emulatorProblems } from "../e2e/emulator-env";

const SAFE = {
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "true",
  FIREBASE_PROJECT_ID: "demo-elora",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-elora",
  FIREBASE_CLIENT_EMAIL: "",
  FIREBASE_PRIVATE_KEY: "",
};

describe("emulatorProblems / assertEmulatorOnly", () => {
  it("accepts a complete emulator configuration", () => {
    expect(emulatorProblems(SAFE)).toEqual([]);
    expect(() => assertEmulatorOnly(SAFE)).not.toThrow();
  });

  it.each(["FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST"])("refuses when %s is missing", (key) => {
    expect(() => assertEmulatorOnly({ ...SAFE, [key]: undefined })).toThrow(/E2E SAFETY STOP/);
  });

  it("refuses a non-local emulator host", () => {
    expect(emulatorProblems({ ...SAFE, FIRESTORE_EMULATOR_HOST: "firestore.googleapis.com:443" })).not.toEqual([]);
  });

  it("refuses when the browser SDK is not in emulator mode", () => {
    expect(emulatorProblems({ ...SAFE, NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "false" })).not.toEqual([]);
  });

  it("refuses the production project, even with emulator hosts set", () => {
    const problems = emulatorProblems({
      ...SAFE,
      FIREBASE_PROJECT_ID: "tia-jewllery",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "tia-jewllery",
    });
    expect(problems.join(" ")).toMatch(/PRODUCTION project "tia-jewllery"/);
  });

  it("refuses any non-demo project and mismatched projects", () => {
    expect(emulatorProblems({ ...SAFE, FIREBASE_PROJECT_ID: "some-real-project" })).not.toEqual([]);
    expect(emulatorProblems({ ...SAFE, NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-other" })).not.toEqual([]);
  });

  it("refuses when real service-account credentials are present", () => {
    expect(emulatorProblems({ ...SAFE, FIREBASE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----" })).not.toEqual([]);
  });
});

describe("buildE2EEnv", () => {
  const dirs: string[] = [];
  const tmp = () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "e2e-env-"));
    dirs.push(dir);
    return dir;
  };
  afterEach(() => dirs.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

  it("uses .env.emulator, never .env.local's production values, and blanks credentials", () => {
    const root = tmp();
    fs.writeFileSync(
      path.join(root, ".env.local"),
      "FIREBASE_PROJECT_ID=tia-jewllery\nNEXT_PUBLIC_FIREBASE_PROJECT_ID=tia-jewllery\nFIREBASE_CLIENT_EMAIL=sa@tia-jewllery.iam.gserviceaccount.com\nFIREBASE_PRIVATE_KEY=secret\nPROD_ONLY_KEY=prod\n",
    );
    fs.writeFileSync(
      path.join(root, ".env.emulator"),
      "FIRESTORE_EMULATOR_HOST=127.0.0.1:8080\nFIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099\nNEXT_PUBLIC_USE_FIREBASE_EMULATORS=true\nFIREBASE_PROJECT_ID=demo-elora\nNEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-elora\n",
    );

    const env = buildE2EEnv(root, {});
    expect(env.FIREBASE_PROJECT_ID).toBe("demo-elora");
    expect(env.FIREBASE_CLIENT_EMAIL).toBe("");
    expect(env.FIREBASE_PRIVATE_KEY).toBe("");
    // Defined-but-empty, so Next.js never fills it from .env.local.
    expect(env.PROD_ONLY_KEY).toBe("");
    expect(emulatorProblems(env)).toEqual([]);
  });

  it("with no .env.emulator and no emulator variables, the result is refused", () => {
    const root = tmp();
    fs.writeFileSync(path.join(root, ".env.local"), "FIREBASE_PROJECT_ID=tia-jewllery\n");
    expect(() => assertEmulatorOnly(buildE2EEnv(root, {}))).toThrow(/E2E SAFETY STOP/);
  });

  it("in CI (no .env.emulator) it uses the job's emulator variables", () => {
    expect(emulatorProblems(buildE2EEnv(tmp(), { ...SAFE }))).toEqual([]);
  });
});
