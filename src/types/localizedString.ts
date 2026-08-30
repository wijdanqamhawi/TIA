/**
 * Shared bilingual text shape (data-model.md). `en` is always required;
 * `ar` is nullable and falls back to `en` for display whenever it is
 * `null`/empty (spec FR-074, Edge Cases).
 */
export type LocalizedString = {
  en: string;
  ar: string | null;
};

/** Resolves the display string for a given locale, falling back to `en`. */
export function resolveLocalizedString(value: LocalizedString, locale: string): string {
  if (locale === "ar" && value.ar) {
    return value.ar;
  }
  return value.en;
}
