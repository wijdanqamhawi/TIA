/**
 * The PWA-facing brand color pair (manifest `theme_color`/`background_color`,
 * `<meta name="theme-color">`, research.md §19/§23). CSS can't be imported
 * into `app/manifest.ts` (a plain TypeScript metadata route), so these are
 * kept here as the single non-CSS source of truth — they MUST stay in sync
 * with `--brand-burgundy`/`--brand-ivory` in `src/app/globals.css`.
 */
export const PWA_THEME_COLOR = "#101c36"; // --brand-burgundy (TIA deep navy)
export const PWA_BACKGROUND_COLOR = "#fcfbf8"; // --brand-ivory (TIA warm white)
