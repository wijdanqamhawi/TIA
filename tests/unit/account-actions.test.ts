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
    const [, patch] = updateMock.mock.calls[0] as [string, { profile: { address: unknown } }];
    expect(patch.profile.address).toEqual(address);
  });

  it("clears the saved address when omitted", async () => {
    await updateProfileAction({ name: "Jane Shopper" });
    const [, patch] = updateMock.mock.calls[0] as [string, { profile: { address: unknown } }];
    expect(patch.profile.address).toBeNull();
  });
});
