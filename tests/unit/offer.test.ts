import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { getEffectivePrice, getOfferStatus, resolveOfferPricing, validateOfferInput } from "@/lib/domain/catalog/offer";

const now = Timestamp.fromMillis(1_700_000_000_000);
const past = Timestamp.fromMillis(now.toMillis() - 1000);
const future = Timestamp.fromMillis(now.toMillis() + 1000);

describe("getOfferStatus", () => {
  it("is DISABLED when isOnSale is false", () => {
    expect(getOfferStatus({ isOnSale: false, salePrice: 8000, saleStartAt: null, saleEndAt: null }, now)).toBe(
      "DISABLED",
    );
  });

  it("is DISABLED when isOnSale is true but salePrice is null", () => {
    expect(getOfferStatus({ isOnSale: true, salePrice: null, saleStartAt: null, saleEndAt: null }, now)).toBe(
      "DISABLED",
    );
  });

  it("is ACTIVE when isOnSale is true and no start/end dates are set", () => {
    expect(getOfferStatus({ isOnSale: true, salePrice: 8000, saleStartAt: null, saleEndAt: null }, now)).toBe(
      "ACTIVE",
    );
  });

  it("is SCHEDULED when now is before saleStartAt", () => {
    expect(getOfferStatus({ isOnSale: true, salePrice: 8000, saleStartAt: future, saleEndAt: null }, now)).toBe(
      "SCHEDULED",
    );
  });

  it("is ACTIVE when now is at or after saleStartAt", () => {
    expect(getOfferStatus({ isOnSale: true, salePrice: 8000, saleStartAt: past, saleEndAt: null }, now)).toBe(
      "ACTIVE",
    );
  });

  it("is EXPIRED when now is at or after saleEndAt", () => {
    expect(getOfferStatus({ isOnSale: true, salePrice: 8000, saleStartAt: null, saleEndAt: past }, now)).toBe(
      "EXPIRED",
    );
  });

  it("is ACTIVE when now is before saleEndAt", () => {
    expect(getOfferStatus({ isOnSale: true, salePrice: 8000, saleStartAt: null, saleEndAt: future }, now)).toBe(
      "ACTIVE",
    );
  });
});

describe("getEffectivePrice", () => {
  it("returns salePrice when ACTIVE", () => {
    const product = { price: 10000, isOnSale: true, salePrice: 8000, saleStartAt: null, saleEndAt: null };
    expect(getEffectivePrice(product, now)).toBe(8000);
  });

  it("returns the regular price when DISABLED", () => {
    const product = { price: 10000, isOnSale: false, salePrice: null, saleStartAt: null, saleEndAt: null };
    expect(getEffectivePrice(product, now)).toBe(10000);
  });

  it("returns the regular price when SCHEDULED (not yet active)", () => {
    const product = { price: 10000, isOnSale: true, salePrice: 8000, saleStartAt: future, saleEndAt: null };
    expect(getEffectivePrice(product, now)).toBe(10000);
  });

  it("returns the regular price when EXPIRED", () => {
    const product = { price: 10000, isOnSale: true, salePrice: 8000, saleStartAt: null, saleEndAt: past };
    expect(getEffectivePrice(product, now)).toBe(10000);
  });
});

describe("resolveOfferPricing", () => {
  it("returns ACTIVE + the sale price for a currently-active, undated offer", () => {
    const product = { price: 10000, isOnSale: true, salePrice: 8000, saleStartAt: null, saleEndAt: null };
    expect(resolveOfferPricing(product)).toEqual({ offerStatus: "ACTIVE", effectivePrice: 8000 });
  });

  it("returns DISABLED + the regular price when isOnSale is false", () => {
    const product = { price: 10000, isOnSale: false, salePrice: null, saleStartAt: null, saleEndAt: null };
    expect(resolveOfferPricing(product)).toEqual({ offerStatus: "DISABLED", effectivePrice: 10000 });
  });
});

describe("validateOfferInput (spec FR-114, SC-027 — shared by productSchema and the admin offer action)", () => {
  it("accepts a disabled offer regardless of salePrice", () => {
    expect(validateOfferInput({ isOnSale: false, salePrice: null, price: 10000 })).toBeNull();
  });

  it("accepts an enabled offer with a valid lower salePrice", () => {
    expect(validateOfferInput({ isOnSale: true, salePrice: 8000, price: 10000 })).toBeNull();
  });

  it("rejects an enabled offer with no salePrice", () => {
    expect(validateOfferInput({ isOnSale: true, salePrice: null, price: 10000 })).not.toBeNull();
  });

  it("rejects an enabled offer with a non-positive salePrice", () => {
    expect(validateOfferInput({ isOnSale: true, salePrice: 0, price: 10000 })).not.toBeNull();
  });

  it("rejects a salePrice equal to price", () => {
    expect(validateOfferInput({ isOnSale: true, salePrice: 10000, price: 10000 })).not.toBeNull();
  });

  it("rejects a salePrice greater than price", () => {
    expect(validateOfferInput({ isOnSale: true, salePrice: 12000, price: 10000 })).not.toBeNull();
  });
});
