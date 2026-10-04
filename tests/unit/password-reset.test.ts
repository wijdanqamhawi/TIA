import { describe, expect, it, vi } from "vitest";
import type { Auth } from "firebase/auth";
import { requestPasswordReset } from "@/lib/firebase/password-reset";

const makeAuth = () => ({ languageCode: null }) as unknown as Auth;
const fail = (code: string) => vi.fn().mockRejectedValue(Object.assign(new Error("x"), { code }));

describe("requestPasswordReset", () => {
  it("sends the reset email to the trimmed address and reports success", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const auth = makeAuth();
    await expect(requestPasswordReset(auth, "  customer@example.com ", "en", send)).resolves.toEqual({ ok: true });
    expect(send).toHaveBeenCalledWith(auth, "customer@example.com");
  });

  it.each(["en", "ar"])("asks Firebase to use the %s language for the email", async (locale) => {
    const auth = makeAuth();
    await requestPasswordReset(auth, "a@b.co", locale, vi.fn().mockResolvedValue(undefined));
    expect(auth.languageCode).toBe(locale);
  });

  it("reports an unregistered email exactly like a registered one (no account enumeration)", async () => {
    const registered = await requestPasswordReset(makeAuth(), "a@b.co", "en", vi.fn().mockResolvedValue(undefined));
    const unknown = await requestPasswordReset(makeAuth(), "nobody@b.co", "en", fail("auth/user-not-found"));
    expect(unknown).toEqual(registered);
  });

  it.each([
    ["auth/invalid-email", "invalidEmail"],
    ["auth/too-many-requests", "tooManyRequests"],
    ["auth/network-request-failed", "generic"],
  ])("surfaces %s as %s", async (code, errorKey) => {
    await expect(requestPasswordReset(makeAuth(), "a@b.co", "en", fail(code))).resolves.toEqual({
      ok: false,
      errorKey,
    });
  });
});
