import { describe, expect, it } from "vitest";
import { profileSchema } from "@/lib/validation/profile.schema";

const validAddress = {
  regionId: "west-bank",
  locationId: "west-bank-ramallah",
  addressLine: "123 Main Street",
  notes: null,
};

describe("profileSchema (T133)", () => {
  it("accepts a name with no phone and no address", () => {
    const result = profileSchema.safeParse({ name: "Layla Hasan" });
    expect(result.success).toBe(true);
  });

  it("rejects a missing name", () => {
    const result = profileSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid phone format", () => {
    const result = profileSchema.safeParse({ name: "Layla Hasan", phone: "call-me-maybe" });
    expect(result.success).toBe(false);
  });

  it("accepts a valid phone", () => {
    const result = profileSchema.safeParse({ name: "Layla Hasan", phone: "+970 599 123 456" });
    expect(result.success).toBe(true);
  });

  it("accepts a null phone", () => {
    const result = profileSchema.safeParse({ name: "Layla Hasan", phone: null });
    expect(result.success).toBe(true);
  });

  it("accepts a valid saved address, validated the same way as checkout's regionId/locationId", () => {
    const result = profileSchema.safeParse({ name: "Layla Hasan", address: validAddress });
    expect(result.success).toBe(true);
  });

  it("rejects an address with a regionId outside the two fixed values", () => {
    const result = profileSchema.safeParse({
      name: "Layla Hasan",
      address: { ...validAddress, regionId: "worldwide" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an address with a missing locationId", () => {
    const result = profileSchema.safeParse({
      name: "Layla Hasan",
      address: { ...validAddress, locationId: "" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an address with a missing addressLine", () => {
    const result = profileSchema.safeParse({
      name: "Layla Hasan",
      address: { ...validAddress, addressLine: "" },
    });
    expect(result.success).toBe(false);
  });

  it("accepts a null address (no saved address yet)", () => {
    const result = profileSchema.safeParse({ name: "Layla Hasan", address: null });
    expect(result.success).toBe(true);
  });
});
