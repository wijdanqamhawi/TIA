/**
 * All prices are stored and computed in minor units (e.g. cents/fils) to
 * avoid floating-point drift in server-side pricing math (spec FR-026,
 * Constitution Principle 9/10). `locale` only changes number formatting,
 * never the underlying amount.
 */

/**
 * The store's display currency: Israeli New Shekel (₪). Every storefront,
 * account and admin price is formatted with it via `formatCurrency`, and
 * the product page's structured data declares it too.
 *
 * Display only — stored prices are plain minor-unit integers with no
 * currency attached, so changing this relabels amounts and never converts
 * them (18500 renders as ₪185.00, just as it rendered as $185.00).
 */
export const STORE_CURRENCY = "ILS";

export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}

export function fromMinorUnits(minorUnits: number): number {
  return minorUnits / 100;
}

export function formatCurrency(
  minorUnits: number,
  locale: string,
  currency = STORE_CURRENCY,
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(fromMinorUnits(minorUnits));
}
