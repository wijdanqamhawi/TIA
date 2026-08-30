/**
 * All prices are stored and computed in minor units (e.g. cents/fils) to
 * avoid floating-point drift in server-side pricing math (spec FR-026,
 * Constitution Principle 9/10). `locale` only changes number formatting,
 * never the underlying amount.
 */

export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}

export function fromMinorUnits(minorUnits: number): number {
  return minorUnits / 100;
}

export function formatCurrency(
  minorUnits: number,
  locale: string,
  currency = "USD",
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(fromMinorUnits(minorUnits));
}
