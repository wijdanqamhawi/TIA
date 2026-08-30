import { describe, expect, it } from "vitest";
import { checkoutSchema } from "@/lib/validation/checkout.schema";

const validCheckout = {
  fullName: "Jane Shopper",
  phone: "+970 599 123 456",
  regionId: "west-bank",
  locationId: "west-bank-ramallah",
  fullAddress: "123 Main Street, Apartment 4",
  email: "jane@example.com",
  notes: null,
  paymentMethod: "CASH_ON_DELIVERY",
};

describe("checkoutSchema (T118/T129, spec: required mobile phone, guest checkout supported)", () => {
  it("accepts a fully valid checkout submission", () => {
    expect(checkoutSchema.safeParse(validCheckout).success).toBe(true);
  });

  it("accepts a valid submission with notes provided", () => {
    const result = checkoutSchema.safeParse({ ...validCheckout, notes: "Please call before delivery." });
    expect(result.success).toBe(true);
  });

  it("accepts a valid submission with notes omitted (optional field)", () => {
    const { notes: _notes, ...withoutNotes } = validCheckout;
    const result = checkoutSchema.safeParse(withoutNotes);
    expect(result.success).toBe(true);
  });

  it("rejects a missing fullName", () => {
    const { fullName: _fullName, ...rest } = validCheckout;
    expect(checkoutSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects an empty phone number (mandatory, this task's explicit requirement)", () => {
    const result = checkoutSchema.safeParse({ ...validCheckout, phone: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing phone field entirely", () => {
    const { phone: _phone, ...rest } = validCheckout;
    expect(checkoutSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects an invalid phone number (letters/invalid characters)", () => {
    const result = checkoutSchema.safeParse({ ...validCheckout, phone: "not-a-phone-number!" });
    expect(result.success).toBe(false);
  });

  it("rejects a phone number that is too short", () => {
    const result = checkoutSchema.safeParse({ ...validCheckout, phone: "123" });
    expect(result.success).toBe(false);
  });

  it("accepts phone numbers with +, -, (), and spaces", () => {
    const result = checkoutSchema.safeParse({ ...validCheckout, phone: "+1 (555) 123-4567" });
    expect(result.success).toBe(true);
  });

  it("rejects a regionId outside the two fixed values", () => {
    const result = checkoutSchema.safeParse({ ...validCheckout, regionId: "worldwide" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing locationId", () => {
    const result = checkoutSchema.safeParse({ ...validCheckout, locationId: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing fullAddress", () => {
    const result = checkoutSchema.safeParse({ ...validCheckout, fullAddress: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing email (required, not optional)", () => {
    const { email: _email, ...rest } = validCheckout;
    expect(checkoutSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects an invalid email format", () => {
    const result = checkoutSchema.safeParse({ ...validCheckout, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects notes longer than 1000 characters", () => {
    const result = checkoutSchema.safeParse({ ...validCheckout, notes: "a".repeat(1001) });
    expect(result.success).toBe(false);
  });

  it("rejects a payment method other than CASH_ON_DELIVERY", () => {
    const result = checkoutSchema.safeParse({ ...validCheckout, paymentMethod: "CREDIT_CARD" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing payment method", () => {
    const { paymentMethod: _paymentMethod, ...rest } = validCheckout;
    expect(checkoutSchema.safeParse(rest).success).toBe(false);
  });
});
