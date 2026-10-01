import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import ar from "../../messages/ar.json";
import {
  DISCOUNT_ERROR_KEY,
  calculateSalePrice,
  deriveDiscountPercent,
  formatDiscountPercent,
  initialDiscountInput,
  parseDiscountPercent,
  resolveOfferSalePrice,
} from "@/lib/domain/catalog/offer-discount";
import { validateOfferInput } from "@/lib/domain/catalog/offer";

/**
 * The shared Special Offer discount logic used by BOTH editors (the
 * /admin/offers drawer and the product form). Money is integer minor units:
 * ₪240.00 = 24000.
 */

describe("calculateSalePrice: salePrice = regular − regular × percent / 100, rounded to 2 decimals", () => {
  it("₪240 with 20% → ₪192.00", () => expect(calculateSalePrice(24000, 20)).toBe(19200));
  it("₪240 with 50% → ₪120.00", () => expect(calculateSalePrice(24000, 50)).toBe(12000));
  it("₪185 with 15% → ₪157.25", () => expect(calculateSalePrice(18500, 15)).toBe(15725));

  it("rounds half-up to a whole minor unit (2 decimal places)", () => {
    expect(calculateSalePrice(9999, 10)).toBe(8999); // 8999.1 → 8999
    expect(calculateSalePrice(1005, 50)).toBe(503); // 502.5 → 503
    expect(calculateSalePrice(10001, 33.33)).toBe(6668); // 6667.6…
    expect(calculateSalePrice(15000, 33.34)).toBe(9999); // ₪150 → ₪99.99
  });

  it("stays exact for decimal percentages (no floating-point drift)", () => {
    expect(calculateSalePrice(24000, 12.5)).toBe(21000);
    expect(calculateSalePrice(24000, 0.5)).toBe(23880);
    expect(calculateSalePrice(24000, 99.99)).toBe(2);
  });
});

describe("deriveDiscountPercent / initialDiscountInput: reopening an existing offer", () => {
  it("derives ((regular − salePrice) / regular) × 100", () => {
    expect(deriveDiscountPercent(24000, 19200)).toBe(20);
    expect(deriveDiscountPercent(24000, 12000)).toBe(50);
    expect(deriveDiscountPercent(18500, 15725)).toBe(15);
  });

  it("rounds a non-round result to a sensible 2 decimals", () => {
    expect(deriveDiscountPercent(24000, 5000)).toBe(79.17); // the real Luna Mesh Watch offer
    expect(formatDiscountPercent(79.17)).toBe("79.17");
    expect(formatDiscountPercent(20)).toBe("20");
    expect(formatDiscountPercent(12.5)).toBe("12.5");
  });

  it("gives no percentage when the saved pair is not a real discount", () => {
    expect(deriveDiscountPercent(24000, null)).toBeNull();
    expect(deriveDiscountPercent(24000, 24000)).toBeNull();
    expect(deriveDiscountPercent(24000, 30000)).toBeNull();
    expect(deriveDiscountPercent(24000, 0)).toBeNull();
    expect(deriveDiscountPercent(0, 100)).toBeNull();
  });

  it("starts the Discount (%) field from the saved prices, empty for a new offer", () => {
    expect(initialDiscountInput({ regular: 24000, salePrice: 19200 })).toBe("20");
    expect(initialDiscountInput({ regular: 24000, salePrice: 5000 })).toBe("79.17");
    expect(initialDiscountInput(null)).toBe("");
  });

  it("a derived percentage recalculates to the saved price for whole-percent offers", () => {
    for (const [regular, sale] of [
      [24000, 19200],
      [18500, 15725],
      [10000, 7500],
    ] as const) {
      const percent = deriveDiscountPercent(regular, sale)!;
      expect(calculateSalePrice(regular, percent)).toBe(sale);
    }
  });
});

describe("parseDiscountPercent: must be above 0 and below 100", () => {
  it("accepts 1–99 and decimals up to 2 places", () => {
    for (const input of ["1", "20", "99", "12.5", "33.34", "0.5", " 15 "]) {
      expect(parseDiscountPercent(input).ok, input).toBe(true);
    }
  });

  it("rejects 0%, 100% and anything above", () => {
    for (const input of ["0", "0.00", "100", "100.5", "150"]) {
      expect(parseDiscountPercent(input), input).toEqual({ ok: false, error: "invalid" });
    }
  });

  it("rejects negative and malformed values", () => {
    for (const input of ["-1", "-20", "abc", "20%", "1e2", "12.345", "1,5", "--5", "+5"]) {
      expect(parseDiscountPercent(input), input).toEqual({ ok: false, error: "invalid" });
    }
  });

  it("reports an empty field as required", () => {
    expect(parseDiscountPercent("")).toEqual({ ok: false, error: "required" });
    expect(parseDiscountPercent("   ")).toEqual({ ok: false, error: "required" });
  });
});

describe("resolveOfferSalePrice: validation of the calculated sale price", () => {
  const resolve = (regular: number | null, percentInput: string, saved = null as never) =>
    resolveOfferSalePrice({ regular, percentInput, saved });

  it("returns the calculated sale price with the percentage", () => {
    expect(resolve(24000, "20")).toEqual({ ok: true, percent: 20, salePrice: 19200 });
    expect(resolve(18500, "15")).toEqual({ ok: true, percent: 15, salePrice: 15725 });
  });

  it("rejects an invalid percentage (0, 100, negative, empty)", () => {
    expect(resolve(24000, "0")).toEqual({ ok: false, error: "invalid" });
    expect(resolve(24000, "100")).toEqual({ ok: false, error: "invalid" });
    expect(resolve(24000, "-5")).toEqual({ ok: false, error: "invalid" });
    expect(resolve(24000, "")).toEqual({ ok: false, error: "required" });
  });

  it("rejects a discount that would leave a sale price of zero", () => {
    expect(resolve(1, "99.99")).toEqual({ ok: false, error: "tooLow" });
    expect(resolve(20, "99.99")).toEqual({ ok: false, error: "tooLow" });
  });

  it("rejects a discount so small that the sale price is not below the regular price", () => {
    expect(resolve(100, "0.01")).toEqual({ ok: false, error: "notBelowRegular" });
    expect(resolve(24000, "0.01")).toMatchObject({ ok: true, salePrice: 23998 });
  });

  it("needs a valid regular price", () => {
    for (const regular of [null, 0, -100, Number.NaN]) {
      expect(resolve(regular, "20")).toEqual({ ok: false, error: "noRegularPrice" });
    }
  });

  it("every valid result satisfies the server's own rule (0 < salePrice < price)", () => {
    for (const regular of [1000, 9999, 18500, 24000]) {
      for (const percent of ["1", "10", "33.33", "50", "99"]) {
        const result = resolve(regular, percent);
        if (!result.ok) continue;
        expect(
          validateOfferInput({ isOnSale: true, salePrice: result.salePrice, price: regular }),
        ).toBeNull();
      }
    }
  });

  it("reopens an unchanged offer with its EXACT saved sale price, even when the shown percentage is rounded", () => {
    const saved = { regular: 24000, salePrice: 5000 }; // 79.1666…% shown as 79.17
    const shown = initialDiscountInput(saved);
    expect(calculateSalePrice(24000, Number(shown))).not.toBe(5000); // recalculating would drift…
    expect(resolveOfferSalePrice({ regular: 24000, percentInput: shown, saved })).toEqual({
      ok: true,
      percent: 79.17,
      salePrice: 5000, // …so the saved price is kept
    });
  });

  it("recalculates as soon as the percentage or the regular price changes", () => {
    const saved = { regular: 24000, salePrice: 5000 };
    expect(resolveOfferSalePrice({ regular: 24000, percentInput: "50", saved })).toMatchObject({
      salePrice: 12000,
    });
    expect(resolveOfferSalePrice({ regular: 30000, percentInput: "79.17", saved })).toMatchObject({
      salePrice: 6249,
    });
  });
});

describe("shared error messages", () => {
  it("both editors have an English and Arabic message for every validation error", () => {
    for (const key of Object.values(DISCOUNT_ERROR_KEY)) {
      for (const messages of [en, ar]) {
        expect(
          (messages.AdminOffers.errors as Record<string, string>)[key],
          `AdminOffers.${key}`,
        ).toBeTruthy();
        expect(
          (messages.AdminProductForm.offer.errors as Record<string, string>)[key],
          `AdminProductForm.${key}`,
        ).toBeTruthy();
      }
    }
    for (const messages of [en, ar]) {
      expect(messages.AdminOffers.drawer.discount).toBeTruthy();
      expect(messages.AdminOffers.drawer.discountHelp).toBeTruthy();
      expect(messages.AdminProductForm.fields.discountPercent).toBeTruthy();
      expect(messages.AdminProductForm.offer.discountHelp).toBeTruthy();
    }
    expect(ar.AdminOffers.drawer.discount).not.toBe(
      en.AdminOffers.drawer.discount.replace("Discount", ""),
    );
  });
});
