import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  REMEMBERED_EMAIL_STORAGE_KEY,
  readRememberedEmail,
  rememberEmail,
} from "@/lib/auth/remembered-email";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

describe("remembered customer email", () => {
  beforeEach(() => window.localStorage.clear());

  it("stores only the email, under one key, trimmed", () => {
    const storage = memoryStorage();
    rememberEmail("  customer@example.com ", storage);
    expect([...storage.data.entries()]).toEqual([[REMEMBERED_EMAIL_STORAGE_KEY, "customer@example.com"]]);
  });

  it("reads it back on a later visit (a fresh read of the same storage)", () => {
    rememberEmail("customer@example.com");
    expect(readRememberedEmail()).toBe("customer@example.com");
    expect(window.localStorage.length).toBe(1);
  });

  it("returns an empty string when nothing is stored", () => {
    expect(readRememberedEmail()).toBe("");
  });

  it.each(["", "   ", "not-an-email", "a b@c.d", `${"a".repeat(260)}@x.com`])(
    "ignores an implausible value %j",
    (value) => {
      const storage = memoryStorage();
      rememberEmail(value, storage);
      expect(storage.data.size).toBe(0);
      window.localStorage.setItem(REMEMBERED_EMAIL_STORAGE_KEY, value);
      expect(readRememberedEmail()).toBe("");
    },
  );

  it("never touches cookies (session cookies are unrelated)", () => {
    const before = document.cookie;
    rememberEmail("customer@example.com");
    readRememberedEmail();
    expect(document.cookie).toBe(before);
  });

  it("never throws when storage is blocked", () => {
    const broken = {
      getItem: vi.fn(() => {
        throw new Error("blocked");
      }),
      setItem: vi.fn(() => {
        throw new Error("blocked");
      }),
    };
    expect(() => rememberEmail("customer@example.com", broken)).not.toThrow();
    expect(readRememberedEmail(broken)).toBe("");
  });
});
