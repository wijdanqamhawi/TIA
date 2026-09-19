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

const { requireAdmin, requireOwner, requireUser, getSessionClaims, UnauthenticatedError, ForbiddenError } = await import(
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

  // Staff roles are additive: ADMIN and OWNER keep full storefront access,
  // so the storefront guard must accept them exactly like a CUSTOMER.
  it.each(["ADMIN", "OWNER"])("requireUser (storefront) also resolves for an authenticated %s", async (role) => {
    cookiesGetMock.mockReturnValue({ value: "cookie" });
    verifySessionCookieMock.mockResolvedValue({ uid: "staff1", email: "staff@tia.com", role });
    await expect(requireUser()).resolves.toMatchObject({ uid: "staff1", role });
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
  it("requireAdmin also resolves for an authenticated OWNER caller", async () => {
    cookiesGetMock.mockReturnValue({ value: "cookie" });
    verifySessionCookieMock.mockResolvedValue({ uid: "owner1", email: "owner@tia.com", role: "OWNER" });
    await expect(requireAdmin()).resolves.toMatchObject({ uid: "owner1", role: "OWNER" });
  });

  it("requireAdmin rejects an unrecognised role value", async () => {
    cookiesGetMock.mockReturnValue({ value: "cookie" });
    verifySessionCookieMock.mockResolvedValue({ uid: "u1", email: "a@b.com", role: "SUPERUSER" });
    await expect(requireAdmin()).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("requireOwner", () => {
  beforeEach(() => {
    cookiesGetMock.mockReset();
    verifySessionCookieMock.mockReset();
  });

  it("rejects an unauthenticated caller", async () => {
    cookiesGetMock.mockReturnValue(undefined);
    await expect(requireOwner()).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it.each(["CUSTOMER", "ADMIN"])("rejects an authenticated %s caller", async (role) => {
    cookiesGetMock.mockReturnValue({ value: "cookie" });
    verifySessionCookieMock.mockResolvedValue({ uid: "u1", email: "a@b.com", role });
    await expect(requireOwner()).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("resolves for an authenticated OWNER caller", async () => {
    cookiesGetMock.mockReturnValue({ value: "cookie" });
    verifySessionCookieMock.mockResolvedValue({ uid: "owner1", email: "owner@tia.com", role: "OWNER" });
    await expect(requireOwner()).resolves.toMatchObject({ uid: "owner1", role: "OWNER" });
  });
});
