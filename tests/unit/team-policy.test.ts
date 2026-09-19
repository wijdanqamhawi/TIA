import { describe, expect, it } from "vitest";
import { claimsWithRole, classifyChange, decideTeamChange } from "@/lib/domain/admin/team.policy";
import type { UserRole } from "@/lib/auth/roles";

const owner = { uid: "owner-1", role: "OWNER" as UserRole };

function decide(opts: {
  actorRole?: UserRole;
  actorUid?: string;
  targetUid?: string;
  from: UserRole;
  to: UserRole;
  disabled?: boolean;
  owners?: number;
}) {
  return decideTeamChange({
    actor: { uid: opts.actorUid ?? owner.uid, role: opts.actorRole ?? "OWNER" },
    target: { uid: opts.targetUid ?? "target-1", role: opts.from, disabled: opts.disabled ?? false },
    toRole: opts.to,
    ownerCount: opts.owners ?? 2,
  });
}

describe("classifyChange", () => {
  it.each([
    ["CUSTOMER", "ADMIN", "GRANT"],
    ["CUSTOMER", "OWNER", "GRANT"],
    ["ADMIN", "OWNER", "PROMOTE"],
    ["OWNER", "ADMIN", "DEMOTE"],
    ["ADMIN", "CUSTOMER", "REVOKE"],
    ["OWNER", "CUSTOMER", "REVOKE"],
  ] as const)("%s → %s is %s", (from, to, kind) => {
    expect(classifyChange(from, to)).toBe(kind);
  });

  it("returns null for no change", () => {
    expect(classifyChange("ADMIN", "ADMIN")).toBeNull();
  });
});

describe("decideTeamChange", () => {
  it.each(["ADMIN", "CUSTOMER"] as const)("only an OWNER may change roles (%s is refused)", (actorRole) => {
    expect(decide({ actorRole, from: "CUSTOMER", to: "ADMIN" })).toEqual({ allowed: false, code: "FORBIDDEN" });
    expect(decide({ actorRole, from: "ADMIN", to: "OWNER" })).toEqual({ allowed: false, code: "FORBIDDEN" });
    expect(decide({ actorRole, from: "OWNER", to: "CUSTOMER" })).toEqual({ allowed: false, code: "FORBIDDEN" });
  });

  it("an owner can never change their own role", () => {
    expect(decide({ targetUid: owner.uid, from: "OWNER", to: "ADMIN", owners: 5 })).toEqual({
      allowed: false,
      code: "SELF_CHANGE",
    });
    expect(decide({ targetUid: owner.uid, from: "OWNER", to: "CUSTOMER", owners: 5 })).toEqual({
      allowed: false,
      code: "SELF_CHANGE",
    });
  });

  it("refuses a no-op change", () => {
    expect(decide({ from: "ADMIN", to: "ADMIN" })).toEqual({ allowed: false, code: "NO_CHANGE" });
  });

  it("refuses giving staff access to a disabled account, but allows removing it", () => {
    expect(decide({ from: "CUSTOMER", to: "ADMIN", disabled: true })).toEqual({ allowed: false, code: "ACCOUNT_DISABLED" });
    expect(decide({ from: "ADMIN", to: "CUSTOMER", disabled: true })).toEqual({ allowed: true, kind: "REVOKE" });
  });

  it.each([
    ["ADMIN", "demote"],
    ["CUSTOMER", "remove"],
  ] as const)("never lets the last OWNER go to %s (%s)", (to, _label) => {
    expect(decide({ from: "OWNER", to, owners: 1 })).toEqual({ allowed: false, code: "LAST_OWNER" });
    expect(decide({ from: "OWNER", to, owners: 0 })).toEqual({ allowed: false, code: "LAST_OWNER" });
  });

  it("allows demoting/removing an owner while another owner remains", () => {
    expect(decide({ from: "OWNER", to: "ADMIN", owners: 2 })).toEqual({ allowed: true, kind: "DEMOTE" });
    expect(decide({ from: "OWNER", to: "CUSTOMER", owners: 2 })).toEqual({ allowed: true, kind: "REVOKE" });
  });

  it("allows the normal owner operations", () => {
    expect(decide({ from: "CUSTOMER", to: "ADMIN" })).toEqual({ allowed: true, kind: "GRANT" });
    expect(decide({ from: "ADMIN", to: "OWNER", owners: 1 })).toEqual({ allowed: true, kind: "PROMOTE" });
    expect(decide({ from: "ADMIN", to: "CUSTOMER", owners: 1 })).toEqual({ allowed: true, kind: "REVOKE" });
  });
});

describe("claimsWithRole", () => {
  it("sets a staff role and keeps unrelated claims", () => {
    expect(claimsWithRole({ tier: "gold", role: "ADMIN" }, "OWNER")).toEqual({ tier: "gold", role: "OWNER" });
    expect(claimsWithRole(undefined, "ADMIN")).toEqual({ role: "ADMIN" });
  });

  it("removes the role for CUSTOMER and keeps unrelated claims", () => {
    expect(claimsWithRole({ tier: "gold", role: "OWNER" }, "CUSTOMER")).toEqual({ tier: "gold" });
    expect(claimsWithRole({ role: "ADMIN" }, "CUSTOMER")).toBeNull();
  });
});
