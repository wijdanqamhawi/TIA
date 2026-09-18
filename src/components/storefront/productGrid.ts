/**
 * The single responsive product-grid class string (research.md §18a):
 * ~2 columns on mobile, ~2–3 on tablet, ~3–4 on laptop/desktop, applied
 * consistently everywhere a product grid renders (Shop, category pages,
 * homepage Featured/Collection strips) rather than each component
 * inventing its own breakpoints.
 */
// Column counts are unchanged (2 / 2 / 3 / 4) — only the gutters grow with
// the viewport, which is what makes a grid read as a curated display case
// rather than a dense results list.
export const PRODUCT_GRID_CLASS =
  "grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-7 lg:gap-y-[1.875rem]";
