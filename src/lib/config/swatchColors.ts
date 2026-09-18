/**
 * Presentation-only swatch fills, keyed by a colour option value's stable
 * `key`. `ProductOptionValue` carries a localized label and nothing else —
 * there is no colour/hex field in the data model, and adding one would be a
 * schema change made purely for a visual concern — so the mapping lives
 * here instead.
 *
 * This is styling, not product data: the selectable values, their labels
 * and the keys written to the cart all come from Firestore. Shared by the
 * product detail panel (`ProductPurchasePanel`) and the catalogue card's
 * colour swatches (`ColorSwatches`) so both paint the same finish for the
 * same value key, from one source.
 *
 * A key this map does not know falls back to `NEUTRAL_SWATCH` — a plain
 * pearl disc. The swatch is never the only affordance: every button also
 * carries the value's real localized label as its accessible name and
 * tooltip, so an unknown colour is still identifiable.
 */
export const SWATCH_COLORS: Record<string, string> = {
  gold: "linear-gradient(135deg, #e3c88b 0%, #c4a46b 55%, #a4843f 100%)",
  silver: "linear-gradient(135deg, #edeff2 0%, #c9ccd1 55%, #9aa0a8 100%)",
  "rose-gold": "linear-gradient(135deg, #f0cfc2 0%, #d9a48f 55%, #b87b66 100%)",
};

export const NEUTRAL_SWATCH = "linear-gradient(135deg, #f3f0ea 0%, #ded8cd 100%)";

export function swatchFill(valueKey: string): string {
  return SWATCH_COLORS[valueKey] ?? NEUTRAL_SWATCH;
}
