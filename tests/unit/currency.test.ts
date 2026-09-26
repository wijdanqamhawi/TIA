import { describe, expect, it } from "vitest";
import { toMinorUnits, fromMinorUnits, formatCurrency } from "@/lib/utils/currency";

describe("currency", () => {
  it("round-trips major/minor units", () => {
    expect(toMinorUnits(19.99)).toBe(1999);
    expect(fromMinorUnits(1999)).toBe(19.99);
  });

  it("formats minor units as a localized currency string", () => {
    expect(formatCurrency(1999, "en-US", "USD")).toBe("$19.99");
  });

  it("displays the store currency (₪) by default, relabelling the amount without converting it", () => {
    expect(formatCurrency(18500, "en")).toBe("₪185.00");
    // Arabic places the symbol after the number, behind a right-to-left mark.
    expect(formatCurrency(18500, "ar")).toBe("‏185.00 ₪");
  });
});
