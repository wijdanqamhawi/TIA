import { describe, expect, it } from "vitest";
import { updateDeliveryRegionSchema } from "@/lib/validation/deliveryRegion.schema";
import { deliveryLocationSchema, updateDeliveryLocationSchema } from "@/lib/validation/deliveryLocation.schema";

describe("updateDeliveryRegionSchema (T262)", () => {
  it("accepts the two fixed region IDs", () => {
    expect(updateDeliveryRegionSchema.safeParse({ regionId: "west-bank" }).success).toBe(true);
    expect(updateDeliveryRegionSchema.safeParse({ regionId: "inside-1948" }).success).toBe(true);
  });

  it("rejects any regionId outside the two fixed values", () => {
    expect(updateDeliveryRegionSchema.safeParse({ regionId: "jordan" }).success).toBe(false);
    expect(updateDeliveryRegionSchema.safeParse({ regionId: "west-bank-2" }).success).toBe(false);
    expect(updateDeliveryRegionSchema.safeParse({ regionId: "" }).success).toBe(false);
  });

  it("accepts a full update payload", () => {
    const result = updateDeliveryRegionSchema.safeParse({
      regionId: "west-bank",
      name: { en: "West Bank", ar: "الضفة الغربية" },
      displayOrder: 1,
      isActive: true,
    });
    expect(result.success).toBe(true);
  });
});

describe("deliveryLocationSchema (T263)", () => {
  const valid = {
    regionId: "west-bank" as const,
    name: { en: "Ramallah", ar: "رام الله" },
    displayOrder: 1,
    isActive: true,
  };

  it("accepts a valid location referencing a fixed region", () => {
    expect(deliveryLocationSchema.safeParse(valid).success).toBe(true);
    expect(deliveryLocationSchema.safeParse({ ...valid, regionId: "inside-1948" }).success).toBe(true);
  });

  it("rejects a regionId outside the two fixed regions", () => {
    expect(deliveryLocationSchema.safeParse({ ...valid, regionId: "gaza" }).success).toBe(false);
  });

  it("rejects a name missing `en`", () => {
    expect(deliveryLocationSchema.safeParse({ ...valid, name: { ar: "رام الله" } }).success).toBe(false);
  });

  it("rejects a negative displayOrder", () => {
    expect(deliveryLocationSchema.safeParse({ ...valid, displayOrder: -1 }).success).toBe(false);
  });
});

describe("updateDeliveryLocationSchema", () => {
  it("requires locationId; every other field is independently optional", () => {
    expect(updateDeliveryLocationSchema.safeParse({ locationId: "loc1" }).success).toBe(true);
    expect(updateDeliveryLocationSchema.safeParse({ locationId: "loc1", isActive: false }).success).toBe(true);
    expect(updateDeliveryLocationSchema.safeParse({ isActive: false }).success).toBe(false);
  });
});
