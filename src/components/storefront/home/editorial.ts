/**
 * Shared class strings for the editorial homepage sections, so the small
 * uppercase kicker, the "VIEW ALL →" style link and the wide-tracked
 * display caps are expressed once.
 *
 * Every uppercase/letter-spaced treatment carries its own `rtl:` reset:
 * Arabic has no case, and wide tracking breaks its joined letterforms.
 */

/** Small wide-tracked kicker ("OUR COLLECTIONS", "THE PIECE"). */
export const KICKER =
  "font-body text-[0.625rem] font-medium uppercase leading-none tracking-[0.28em] rtl:text-[0.8125rem] rtl:normal-case rtl:tracking-normal";

/** Inline text link with trailing arrow ("VIEW ALL →", "DISCOVER →"). */
export const ARROW_LINK =
  "group/arrow inline-flex min-h-11 items-center gap-2 font-body text-[0.625rem] font-medium uppercase tracking-[0.24em] transition-opacity hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current rtl:text-xs rtl:normal-case rtl:tracking-normal";

/** The arrow icon inside `ARROW_LINK`; mirrored under RTL. */
export const ARROW_ICON =
  "transition-transform duration-300 ease-luxury group-hover/arrow:translate-x-1 rtl:-scale-x-100 rtl:group-hover/arrow:-translate-x-1";

/** Rectangular outlined CTA ("EXPLORE LOOK →"). */
export const OUTLINE_CTA =
  "group/arrow inline-flex min-h-12 items-center justify-center gap-3 border border-current px-7 font-body text-[0.6875rem] font-medium uppercase tracking-[0.24em] transition-colors duration-300 hover:bg-text-primary hover:text-text-on-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current rtl:text-xs rtl:normal-case rtl:tracking-normal";

/** Display caps for headings like "NEW ARRIVALS" / "LESS ORDINARY." */
export const DISPLAY_CAPS = "uppercase tracking-[0.1em] rtl:normal-case rtl:tracking-normal";
