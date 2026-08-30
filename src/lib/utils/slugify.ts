/**
 * Derives a URL-safe, language-independent slug from an English string
 * (e.g. a product/category `name.en`). Slugs never come from Arabic text
 * (data-model.md, "Bilingual content never affects identity").
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
