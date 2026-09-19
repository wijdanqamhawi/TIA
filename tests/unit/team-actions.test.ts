import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The admin-team Server Actions: every one is gated by `requireOwner()`
 * (an ADMIN or signed-out caller gets FORBIDDEN and the service is never
 * called), inputs are validated, and each action asks the service for
 * exactly the right role change.
 */

class FakeForbiddenError extends Error {}
class FakeUnauthenticatedError extends Error {}
const requireOwnerMock = vi.fn();

vi.mock("@/lib/firebase/guards", () => ({
  requireOwner: () => requireOwnerMock(),
  ForbiddenError: FakeForbiddenError,
  UnauthenticatedError: FakeUnauthenticatedError,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const changeTeamRoleMock = vi.fn();
const findAccountByEmailMock = vi.fn();
vi.mock("@/lib/domain/admin/team.service", () => ({
  changeTeamRole: (params: unknown) => changeTeamRoleMock(params),
  findAccountByEmail: (email: string) => findAccountByEmailMock(email),
}));

const { lookupTeamAccountAction, grantAdminAction, changeAdminRoleAction, removeAdminAction } = await import(
  "@/actions/admin/team.actions"
);

const owner = { uid: "owner-a", email: "owner@gmail.com", role: "OWNER" };
const account = { uid: "u-1", name: "Sara", email: "sara@gmail.com", role: "CUSTOMER", disabled: false };

beforeEach(() => {
  requireOwnerMock.mockReset().mockResolvedValue(owner);
  changeTeamRoleMock.mockReset().mockResolvedValue({
    ok: true,
    kind: "GRANT",
    fromRole: "CUSTOMER",
    toRole: "ADMIN",
    email: "sara@gmail.com",
  });
  findAccountByEmailMock.mockReset().mockResolvedValue(account);
});

describe("owner-only gate", () => {
  const calls = [
    ["lookupTeamAccountAction", () => lookupTeamAccountAction({ email: "sara@gmail.com" })],
    ["grantAdminAction", () => grantAdminAction({ email: "sara@gmail.com" })],
    ["changeAdminRoleAction", () => changeAdminRoleAction({ uid: "u-1", role: "OWNER" })],
    ["removeAdminAction", () => removeAdminAction({ uid: "u-1", confirmEmail: "sara@gmail.com" })],
  ] as const;

  it.each(calls)("%s refuses a non-owner (ADMIN) without touching the service", async (_name, call) => {
    requireOwnerMock.mockRejectedValue(new FakeForbiddenError());
    const result = await call();
    expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(changeTeamRoleMock).not.toHaveBeenCalled();
    expect(findAccountByEmailMock).not.toHaveBeenCalled();
  });

  it.each(calls)("%s refuses a signed-out caller", async (_name, call) => {
    requireOwnerMock.mockRejectedValue(new FakeUnauthenticatedError());
    expect(await call()).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(changeTeamRoleMock).not.toHaveBeenCalled();
  });
});

describe("lookupTeamAccountAction", () => {
  it("normalizes the email and returns the account", async () => {
    const result = await lookupTeamAccountAction({ email: "  Sara@Gmail.com " });
    expect(findAccountByEmailMock).toHaveBeenCalledWith("sara@gmail.com");
    expect(result).toEqual({ ok: true, data: account });
  });

  it("reports NOT_FOUND and never creates an account", async () => {
    findAccountByEmailMock.mockResolvedValue(null);
    expect(await lookupTeamAccountAction({ email: "ghost@gmail.com" })).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
    expect(changeTeamRoleMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid email", async () => {
    expect(await lookupTeamAccountAction({ email: "nope" })).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
  });
});

describe("mutations", () => {
  it("grantAdminAction grants ADMIN (never OWNER) to the looked-up account", async () => {
    expect(await grantAdminAction({ email: "sara@gmail.com" })).toEqual({ ok: true, data: { email: "sara@gmail.com" } });
    expect(changeTeamRoleMock).toHaveBeenCalledWith({ actor: owner, targetUid: "u-1", toRole: "ADMIN" });
  });

  it("changeAdminRoleAction only accepts ADMIN or OWNER", async () => {
    await changeAdminRoleAction({ uid: "u-1", role: "OWNER" });
    expect(changeTeamRoleMock).toHaveBeenCalledWith({ actor: owner, targetUid: "u-1", toRole: "OWNER" });

    expect(await changeAdminRoleAction({ uid: "u-1", role: "CUSTOMER" })).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" },
    });
    expect(await changeAdminRoleAction({ uid: "u-1", role: "SUPERUSER" })).toMatchObject({ ok: false });
  });

  it("removeAdminAction removes to CUSTOMER and passes the typed confirmation through", async () => {
    await removeAdminAction({ uid: "u-1", confirmEmail: "sara@gmail.com" });
    expect(changeTeamRoleMock).toHaveBeenCalledWith({
      actor: owner,
      targetUid: "u-1",
      toRole: "CUSTOMER",
      confirmEmail: "sara@gmail.com",
    });
    expect(await removeAdminAction({ uid: "u-1", confirmEmail: "" })).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" },
    });
  });

  it("returns a generic UNKNOWN (never the raw error) when the service throws", async () => {
    changeTeamRoleMock.mockRejectedValue(new Error("internal: firestore exploded"));
    const result = await changeAdminRoleAction({ uid: "u-1", role: "ADMIN" });
    expect(result).toMatchObject({ ok: false, error: { code: "UNKNOWN" } });
    expect(JSON.stringify(result)).not.toContain("firestore exploded");
  });

  it.each(["SELF_CHANGE", "LAST_OWNER", "BUSY", "NO_CHANGE", "CONFIRMATION_MISMATCH"])(
    "surfaces the service's %s refusal as a stable error code",
    async (code) => {
      changeTeamRoleMock.mockResolvedValue({ ok: false, code });
      expect(await changeAdminRoleAction({ uid: "u-1", role: "ADMIN" })).toMatchObject({ ok: false, error: { code } });
    },
  );
});
