import { describe, expect, it } from "vitest";
import {
  checkTargetEnvironment,
  isAdminClaims,
  maskEmail,
  parseEmailArgs,
  withAdminRole,
  withoutAdminRole,
} from "../../scripts/admin/core";

const SAFE_ENV = {
  FIREBASE_PROJECT_ID: "tia-jewllery",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "tia-jewllery",
  FIREBASE_CLIENT_EMAIL: "firebase-adminsdk-x@tia-jewllery.iam.gserviceaccount.com",
  FIREBASE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\n...",
};

describe("checkTargetEnvironment", () => {
  it("accepts the real TIA project", () => {
    expect(checkTargetEnvironment(SAFE_ENV)).toEqual([]);
  });

  it.each(["FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST"])(
    "refuses when %s is set",
    (name) => {
      expect(checkTargetEnvironment({ ...SAFE_ENV, [name]: "127.0.0.1:8080" })).toHaveLength(1);
    },
  );

  it("refuses any other project id, including the old emulator demo project", () => {
    expect(checkTargetEnvironment({ ...SAFE_ENV, FIREBASE_PROJECT_ID: "demo-elora" })).not.toEqual([]);
    expect(checkTargetEnvironment({ ...SAFE_ENV, NEXT_PUBLIC_FIREBASE_PROJECT_ID: "other" })).not.toEqual([]);
  });

  it("refuses a service account from another project", () => {
    const env = { ...SAFE_ENV, FIREBASE_CLIENT_EMAIL: "sa@other-project.iam.gserviceaccount.com" };
    expect(checkTargetEnvironment(env)).not.toEqual([]);
  });

  it("refuses when credentials are missing", () => {
    expect(checkTargetEnvironment({})).toHaveLength(4);
  });
});

describe("parseEmailArgs", () => {
  it("normalizes a single email", () => {
    expect(parseEmailArgs(["  Someone@Gmail.COM "])).toEqual({ email: "someone@gmail.com", flags: new Set(), role: "ADMIN" });
  });

  it("rejects a second positional value, so a password can never be passed", () => {
    expect(parseEmailArgs(["a@gmail.com", "hunter2"])).toHaveProperty("error");
  });

  it("rejects missing, malformed and unknown input", () => {
    expect(parseEmailArgs([])).toHaveProperty("error");
    expect(parseEmailArgs(["not-an-email"])).toHaveProperty("error");
    expect(parseEmailArgs(["a@gmail.com", "--password=x"], ["--yes"])).toHaveProperty("error");
  });

  it("accepts only the allowed flags", () => {
    const parsed = parseEmailArgs(["a@gmail.com", "--yes"], ["--yes"]);
    expect(parsed).toEqual({ email: "a@gmail.com", flags: new Set(["--yes"]), role: "ADMIN" });
  });

  it("accepts --role owner|admin only where allowed", () => {
    expect(parseEmailArgs(["a@gmail.com", "--role", "owner"], [], { allowRole: true })).toMatchObject({ role: "OWNER" });
    expect(parseEmailArgs(["a@gmail.com", "--role=admin"], [], { allowRole: true })).toMatchObject({ role: "ADMIN" });
    expect(parseEmailArgs(["a@gmail.com", "--role", "superuser"], [], { allowRole: true })).toHaveProperty("error");
    expect(parseEmailArgs(["a@gmail.com", "--role", "owner"])).toHaveProperty("error");
  });
});

describe("admin claims", () => {
  it("detects the admin role", () => {
    expect(isAdminClaims({ role: "ADMIN" })).toBe(true);
    expect(isAdminClaims({ role: "OWNER" })).toBe(true);
    expect(isAdminClaims({ role: "CUSTOMER" })).toBe(false);
    expect(isAdminClaims(undefined)).toBe(false);
  });

  it("grants without dropping unrelated claims", () => {
    expect(withAdminRole({ tier: "gold" })).toEqual({ tier: "gold", role: "ADMIN" });
    expect(withAdminRole(undefined)).toEqual({ role: "ADMIN" });
    expect(withAdminRole({ tier: "gold", role: "ADMIN" }, "OWNER")).toEqual({ tier: "gold", role: "OWNER" });
  });

  it("revokes without dropping unrelated claims, and clears when nothing is left", () => {
    expect(withoutAdminRole({ tier: "gold", role: "ADMIN" })).toEqual({ tier: "gold" });
    expect(withoutAdminRole({ role: "ADMIN" })).toBeNull();
  });
});

describe("maskEmail", () => {
  it("hides the local part", () => {
    expect(maskEmail("someone@gmail.com")).toBe("so•••@gmail.com");
    expect(maskEmail("broken")).toBe("•••");
  });
});
