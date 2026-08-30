/**
 * The PWA-facing brand color pair (manifest `theme_color`/`background_color`,
 * `<meta name="theme-color">`, research.md §19/§23). CSS can't be imported
 * into `app/manifest.ts` (a plain TypeScript metadata route), so these are
 * kept here as the single non-CSS source of truth — they MUST stay in sync
 * with `--brand-burgundy`/`--brand-cream` in `src/app/globals.css`.
 */
export const PWA_THEME_COLOR = "#6d1b34"; // --brand-burgundy
export const PWA_BACKGROUND_COLOR = "#fdf6ec"; // --brand-cream
