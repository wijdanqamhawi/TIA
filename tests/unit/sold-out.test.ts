import { describe, expect, it } from "vitest";
import { isSoldOut } from "@/lib/domain/catalog/soldOut";
import { validateCartLineAvailability } from "@/lib/domain/catalog/product.service";
import { productSchema } from "@/lib/validation/product.schema";

describe("isSoldOut derivation (data-model.md, spec FR-015a)", () => {
  it("is true when stock is exactly 0", () => {
    expect(isSoldOut({ stock: 0 })).toBe(true);
  });

  it("is false when stock is greater than 0", () => {
    expect(isSoldOut({ stock: 1 })).toBe(false);
    expect(isSoldOut({ stock: 100 })).toBe(false);
  });
});

describe("Product schema rejects negative stock (spec edge cases)", () => {
  const base = {
    name: { en: "Gold Ring", ar: null },
    description: { en: "A ring.", ar: null },
    material: { en: "Gold", ar: null },
    price: 10000,
    categoryId: "rings",
    images: [],
    options: [],
    availability: true,
  };

  it("rejects stock = -1", () => {
    expect(productSchema.safeParse({ ...base, stock: -1 }).success).toBe(false);
  });

  it("accepts stock = 0 (a valid Sold Out state)", () => {
    expect(productSchema.safeParse({ ...base, stock: 0 }).success).toBe(true);
  });
});

describe("validateCartLineAvailability (spec Edge Cases; T087)", () => {
  const available = { availability: true, stock: 5 };
  const soldOut = { availability: true, stock: 0 };
  const hidden = { availability: false, stock: 5 };

  it("accepts a valid quantity against an available, in-stock product", () => {
    expect(validateCartLineAvailability(available, 2)).toEqual({ ok: true });
  });

  it("rejects any quantity for a Sold Out product", () => {
    expect(validateCartLineAvailability(soldOut, 1)).toEqual({ ok: false, reason: "SOLD_OUT" });
  });

  it("rejects any quantity for a hidden (availability: false) product", () => {
    expect(validateCartLineAvailability(hidden, 1)).toEqual({ ok: false, reason: "NOT_AVAILABLE" });
  });

  it("rejects a quantity exceeding stock", () => {
    expect(validateCartLineAvailability(available, 6)).toEqual({ ok: false, reason: "INSUFFICIENT_STOCK" });
  });

  it("rejects a zero or negative quantity", () => {
    expect(validateCartLineAvailability(available, 0)).toEqual({ ok: false, reason: "INVALID_QUANTITY" });
    expect(validateCartLineAvailability(available, -1)).toEqual({ ok: false, reason: "INVALID_QUANTITY" });
  });

  it("T092: restocking (raising stock above 0) makes the product valid again with no extra field/action", () => {
    const restocked = { availability: true, stock: 3 };
    expect(isSoldOut(restocked)).toBe(false);
    expect(validateCartLineAvailability(restocked, 1)).toEqual({ ok: true });
  });
});
