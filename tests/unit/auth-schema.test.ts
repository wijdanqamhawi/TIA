import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "@/lib/validation/auth.schema";

describe("registerSchema", () => {
  it("accepts valid input", () => {
    const result = registerSchema.safeParse({
      name: "Layla Hasan",
      email: "layla@example.com",
      password: "supersecret1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing name", () => {
    const result = registerSchema.safeParse({
      name: "",
      email: "layla@example.com",
      password: "supersecret1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = registerSchema.safeParse({
      name: "Layla Hasan",
      email: "not-an-email",
      password: "supersecret1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = registerSchema.safeParse({
      name: "Layla Hasan",
      email: "layla@example.com",
      password: "short1",
    });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts valid input", () => {
    const result = loginSchema.safeParse({ email: "layla@example.com", password: "anything" });
    expect(result.success).toBe(true);
  });

  it("rejects a missing password", () => {
    const result = loginSchema.safeParse({ email: "layla@example.com", password: "" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = loginSchema.safeParse({ email: "nope", password: "anything" });
    expect(result.success).toBe(false);
  });
});
