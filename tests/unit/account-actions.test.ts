import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit-tests `updateProfileAction` (T134, spec User Story 2): auth
 * required, and the `uid` written to is always the verified session's
 * own — never a client-supplied one.
 */

class FakeUnauthenticatedError extends Error {}

const requireUserMock = vi.fn();
vi.mock("@/lib/firebase/guards", () => ({
  requireUser: () => requireUserMock(),
  UnauthenticatedError: FakeUnauthenticatedError,
}));

const updateMock = vi.fn();
vi.mock("@/lib/firebase/firestore", () => ({
  usersCollection: () => ({
    doc: (uid: string) => ({
      update: (patch: unknown) => updateMock(uid, patch),
    }),
  }),
}));

const { updateProfileAction } = await import("@/actions/account.actions");

describe("updateProfileAction", () => {
  beforeEach(() => {
    requireUserMock.mockReset().mockResolvedValue({ uid: "user-1", role: "CUSTOMER" });
    updateMock.mockReset();
  });

  it("rejects an unauthenticated caller without touching Firestore", async () => {
    requireUserMock.mockRejectedValue(new FakeUnauthenticatedError());
    const result = await updateProfileAction({ name: "Jane" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("UNAUTHENTICATED");
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("rejects invalid input", async () => {
    const result = await updateProfileAction({ name: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR");
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("updates only the verified session's own uid, never a client-supplied one", async () => {
    const result = await updateProfileAction({ name: "Jane Shopper", uid: "someone-elses-uid" });
    expect(result.ok).toBe(true);
    expect(updateMock).toHaveBeenCalledTimes(1);
    const [uid] = updateMock.mock.calls[0];
    expect(uid).toBe("user-1");
  });

  it("never writes email or role fields", async () => {
    await updateProfileAction({ name: "Jane Shopper" });
    const [, patch] = updateMock.mock.calls[0];
    expect(patch).not.toHaveProperty("email");
    expect(patch).not.toHaveProperty("role");
  });

  it("saves a valid address", async () => {
    const address = { regionId: "west-bank", locationId: "west-bank-ramallah", addressLine: "123 Main St", notes: null };
    const result = await updateProfileAction({ name: "Jane Shopper", address });
    expect(result.ok).toBe(true);
    const [, patch] = updateMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(patch["profile.address"]).toEqual(address);
  });

  it("keeps the saved address and date of birth when they are omitted", async () => {
    await updateProfileAction({ name: "Jane Shopper" });
    const [, patch] = updateMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(patch).not.toHaveProperty("profile");
    expect(patch).not.toHaveProperty("profile.address");
    expect(patch).not.toHaveProperty("profile.dateOfBirth");
  });

  it("clears the saved address only when explicitly null", async () => {
    await updateProfileAction({ name: "Jane Shopper", address: null });
    const [, patch] = updateMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(patch["profile.address"]).toBeNull();
  });

  it("saves, and clears, an optional date of birth", async () => {
    await updateProfileAction({ name: "Jane Shopper", dateOfBirth: "1994-03-21" });
    expect((updateMock.mock.calls[0] as [string, Record<string, unknown>])[1]["profile.dateOfBirth"]).toBe("1994-03-21");

    await updateProfileAction({ name: "Jane Shopper", dateOfBirth: null });
    expect((updateMock.mock.calls[1] as [string, Record<string, unknown>])[1]["profile.dateOfBirth"]).toBeNull();
  });

  it.each(["21/03/1994", "1994-02-30", "1899-12-31", "2999-01-01", "not-a-date"])(
    "rejects an invalid date of birth (%s)",
    async (dateOfBirth) => {
      const result = await updateProfileAction({ name: "Jane Shopper", dateOfBirth });
      expect(result.ok).toBe(false);
      expect(updateMock).not.toHaveBeenCalled();
    },
  );
});
