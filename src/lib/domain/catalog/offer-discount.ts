/**
 * The one place a Special Offer's discount percentage is turned into a sale
 * price, validated, and derived back from a saved sale price. Shared by the
 * /admin/offers drawer and the product form's Special Offer section, so the
 * two editors can never disagree.
 *
 * The persisted source of truth stays `Product.salePrice` (integer minor
 * units) — what the storefront, cart and checkout read. The percentage is
 * only an editing aid: it is derived from `price` and `salePrice` when an
 * offer is opened and never stored. PURE: no imports, safe in the browser.
 *
 * All money here is integer minor units (₪240.00 = 24000); rounding to whole
 * minor units is rounding to 2 decimal places.
 */

export type DiscountError = "required" | "invalid" | "tooLow" | "notBelowRegular" | "noRegularPrice";

export type DiscountResult =
  { ok: true; percent: number; salePrice: number } | { ok: false; error: DiscountError };

/** Translation key (in each editor's own `errors` block) for every validation failure. */
export const DISCOUNT_ERROR_KEY: Record<DiscountError, string> = {
  required: "discountRequired",
  invalid: "discountInvalid",
  tooLow: "discountTooLow",
  notBelowRegular: "discountNotBelow",
  noRegularPrice: "noRegularPrice",
};

/** A saved offer's prices, used to reopen it without any rounding drift. */
export type SavedOfferPrice = { regular: number; salePrice: number };

/** Accepts `20`, `12.5`, `33.34` — digits with at most two decimals, no sign, no exponent. */
const PERCENT_PATTERN = /^\d+(\.\d{1,2})?$/;

/**
 * `salePrice = regular − regular × percent / 100`, rounded half-up to a whole
 * minor unit. The percent is taken in hundredths (basis points) so the
 * arithmetic stays on integers: 24000 at 20% → 19200; 18500 at 15% → 15725.
 */
export function calculateSalePrice(regular: number, percent: number): number {
  const basisPoints = Math.round(percent * 100);
  return Math.floor((regular * (10000 - basisPoints) + 5000) / 10000);
}

/**
 * The discount an existing sale price represents, rounded to 2 decimals
 * (24000 → 19200 is `20`; 24000 → 5000 is `79.17`), or `null` when the pair
 * is not a real discount (no sale price, or one not below the regular price).
 */
export function deriveDiscountPercent(regular: number, salePrice: number | null): number | null {
  if (salePrice === null || regular <= 0 || salePrice <= 0 || salePrice >= regular) return null;
  return Math.round(((regular - salePrice) / regular) * 10000) / 100;
}

/** `20` → "20", `79.17` → "79.17", `12.5` → "12.5" — no trailing zeros. */
export function formatDiscountPercent(percent: number): string {
  return String(Number(percent.toFixed(2)));
}

/** The text a Discount (%) field starts with when an offer is opened ("" for a new one). */
export function initialDiscountInput(saved: SavedOfferPrice | null): string {
  if (!saved) return "";
  const percent = deriveDiscountPercent(saved.regular, saved.salePrice);
  return percent === null ? "" : formatDiscountPercent(percent);
}

export function parseDiscountPercent(
  input: string,
): { ok: true; percent: number } | { ok: false; error: "required" | "invalid" } {
  const text = input.trim();
  if (text === "") return { ok: false, error: "required" };
  if (!PERCENT_PATTERN.test(text)) return { ok: false, error: "invalid" };
  const percent = Number(text);
  // Strictly between 0 and 100.
  if (!(percent > 0 && percent < 100)) return { ok: false, error: "invalid" };
  return { ok: true, percent };
}

/**
 * The sale price for what the admin has typed, or why it is not valid.
 *
 * When the offer is reopened and neither the regular price nor the
 * percentage has been changed, the SAVED sale price is returned exactly:
 * the displayed percentage is rounded, and recalculating from it could
 * otherwise nudge a saved price by a fraction of a cent.
 */
export function resolveOfferSalePrice(args: {
  /** Regular price, minor units, or `null` when it is not (yet) a valid number. */
  regular: number | null;
  percentInput: string;
  saved: SavedOfferPrice | null;
}): DiscountResult {
  const { regular, percentInput, saved } = args;
  if (regular === null || !Number.isFinite(regular) || regular <= 0) return { ok: false, error: "noRegularPrice" };

  if (saved && regular === saved.regular && percentInput.trim() === initialDiscountInput(saved)) {
    const percent = deriveDiscountPercent(saved.regular, saved.salePrice);
    if (percent !== null) return { ok: true, percent, salePrice: saved.salePrice };
  }

  const parsed = parseDiscountPercent(percentInput);
  if (!parsed.ok) return parsed;

  const salePrice = calculateSalePrice(regular, parsed.percent);
  if (salePrice <= 0) return { ok: false, error: "tooLow" };
  if (salePrice >= regular) return { ok: false, error: "notBelowRegular" };
  return { ok: true, percent: parsed.percent, salePrice };
}
