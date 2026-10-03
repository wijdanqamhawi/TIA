import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyMock = vi.fn();
const warnMock = vi.fn();

vi.mock("@/lib/firebase/admin", () => ({ getAdminAuth: () => ({ verifySessionCookie: verifyMock }) }));
vi.mock("@/lib/utils/logger", () => ({ logger: { warn: (...a: unknown[]) => warnMock(...a) } }));

const { verifySessionCookie } = await import("@/lib/firebase/auth");

const SECRET_COOKIE = "eyJhbGciOi.SECRET-COOKIE-PAYLOAD.signature";

beforeEach(() => vi.clearAllMocks());

describe("verifySessionCookie diagnostics", () => {
  it("returns claims for a valid cookie and logs nothing", async () => {
    verifyMock.mockResolvedValue({ uid: "u1", email: "a@b.c", role: "CUSTOMER" });
    await expect(verifySessionCookie(SECRET_COOKIE)).resolves.toEqual({ uid: "u1", email: "a@b.c", role: "CUSTOMER" });
    expect(warnMock).not.toHaveBeenCalled();
  });

  it("returns null and logs only the error class/code — never the cookie or the message", async () => {
    const err = Object.assign(new Error(`bad cookie ${SECRET_COOKIE}`), { code: "auth/session-cookie-revoked" });
    verifyMock.mockRejectedValue(err);
    await expect(verifySessionCookie(SECRET_COOKIE)).resolves.toBeNull();
    expect(warnMock).toHaveBeenCalledWith("verifySessionCookie: rejected", {
      errorName: "Error",
      errorCode: "auth/session-cookie-revoked",
    });
    expect(JSON.stringify(warnMock.mock.calls)).not.toContain("SECRET-COOKIE");
  });
});
