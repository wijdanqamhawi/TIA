/**
 * Tokenizes text into lowercase keyword tokens for Firestore's
 * `array-contains-any` keyword-array search pattern (research.md §17a) —
 * Firestore has no native full-text search, so this is a deliberate,
 * documented lightweight substitute at this project's launch scale, not a
 * silent gap. Reused verbatim for delivery-location search (research.md
 * §44) so there is exactly one tokenization implementation in the codebase.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .split(/[^\p{L}\p{N}]+/u)
    .map((token) => token.trim())
    .filter(Boolean);
}

/**
 * Builds the deduplicated `searchTerms` token set for a bilingual entity
 * from any number of source strings (e.g. `name.en`, `name.ar`, a
 * category's localized name) — matches regardless of which language the
 * shopper is typing in.
 */
export function buildSearchTerms(...sources: Array<string | null | undefined>): string[] {
  const tokens = new Set<string>();

  for (const source of sources) {
    if (!source) continue;
    for (const token of tokenize(source)) {
      tokens.add(token);
    }
  }

  return Array.from(tokens);
}
