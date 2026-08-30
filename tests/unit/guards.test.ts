import { beforeEach, describe, expect, it, vi } from "vitest";

const cookiesGetMock = vi.fn();
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookiesGetMock }),
}));

const verifySessionCookieMock = vi.fn();
vi.mock("@/lib/firebase/auth", () => ({
  SESSION_COOKIE_NAME: "__session",
  verifySessionCookie: verifySessionCookieMock,
}));

const { requireAdmin, requireUser, getSessionClaims, UnauthenticatedError, ForbiddenError } = await import(
  "@/lib/firebase/guards"
);

describe("getSessionClaims / requireUser / requireAdmin", () => {
  beforeEach(() => {
    cookiesGetMock.mockReset();
    verifySessionCookieMock.mockReset();
  });

  it("getSessionClaims returns null when there is no session cookie", async () => {
    cookiesGetMock.mockReturnValue(undefined);
    await expect(getSessionClaims()).resolves.toBeNull();
    expect(verifySessionCookieMock).not.toHaveBeenCalled();
  });

  it("requireUser rejects an unauthenticated caller (no cookie)", async () => {
    cookiesGetMock.mockReturnValue(undefined);
    await expect(requireUser()).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it("requireUser rejects when the session cookie fails verification", async () => {
    cookiesGetMock.mockReturnValue({ value: "stale-cookie" });
    verifySessionCookieMock.mockResolvedValue(null);
    await expect(requireUser()).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it("requireUser resolves for any authenticated caller", async () => {
    cookiesGetMock.mockReturnValue({ value: "cookie" });
    verifySessionCookieMock.mockResolvedValue({ uid: "u1", email: "a@b.com", role: "CUSTOMER" });
    await expect(requireUser()).resolves.toEqual({ uid: "u1", email: "a@b.com", role: "CUSTOMER" });
  });

  it("requireAdmin rejects an unauthenticated caller", async () => {
    cookiesGetMock.mockReturnValue(undefined);
    await expect(requireAdmin()).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it("requireAdmin rejects an authenticated non-admin (CUSTOMER) caller", async () => {
    cookiesGetMock.mockReturnValue({ value: "cookie" });
    verifySessionCookieMock.mockResolvedValue({ uid: "u1", email: "a@b.com", role: "CUSTOMER" });
    await expect(requireAdmin()).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("requireAdmin resolves for an authenticated ADMIN caller", async () => {
    cookiesGetMock.mockReturnValue({ value: "cookie" });
    verifySessionCookieMock.mockResolvedValue({ uid: "admin1", email: "admin@elora.com", role: "ADMIN" });
    await expect(requireAdmin()).resolves.toEqual({
      uid: "admin1",
      email: "admin@elora.com",
      role: "ADMIN",
    });
  });
});
