import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/config/site";

type LogoProps = {
  locale?: string;
  className?: string;
  /** Extra classes for the wordmark itself (e.g. a size override). */
  imageClassName?: string;
  /** Show the "Accessories & More" descriptor beneath the wordmark. */
  showTagline?: boolean;
  /** Retained for API compatibility with the previous `next/image`-based logo; the wordmark is text, so there is nothing to preload. */
  priority?: boolean;
};

/**
 * The TIA wordmark.
 *
 * Rendered as live text in the brand's editorial serif rather than as an
 * image, for three reasons that all matter here:
 *
 *  1. **It has to work on both grounds.** The supplied TIA artwork is a
 *     square navy tile with a white wordmark. That is exactly right on the
 *     welcome screen (which uses the asset itself, see `WelcomeSplash`),
 *     but it cannot sit in a warm-white navbar. Text inherits
 *     `currentColor`, so the same component is navy-on-white in the header
 *     and white-on-navy wherever the ground is dark, with no second asset
 *     and no recolouring.
 *  2. **It stays sharp and weightless** at every density, and costs no
 *     image request on the critical path.
 *  3. **It respects RTL** without ever being mirrored — the wordmark is
 *     Latin and `dir="ltr"` is pinned below, so an Arabic page shows the
 *     brand exactly as designed rather than reversed.
 *
 * The letterforms and the wide-tracked descriptor mirror the supplied
 * lockup's proportions. Replace with the official vector artwork when a
 * transparent-background version exists — only this file changes.
 */
export function Logo({ locale, className, imageClassName, showTagline, priority }: LogoProps) {
  void priority;
  const href = locale ? `/${locale}` : "/";

  return (
    <Link
      href={href}
      className={cn("group/logo inline-flex flex-col items-center leading-none", className)}
      aria-label={`${SITE_NAME} — Home`}
    >
      <span
        // Pinned LTR so the Latin wordmark is never reversed on an Arabic page.
        dir="ltr"
        className={cn(
          "font-display font-normal tracking-[0.28em] text-current",
          "text-xl sm:text-2xl",
          imageClassName,
        )}
      >
        {SITE_NAME}
      </span>
      {showTagline ? (
        <span
          dir="ltr"
          aria-hidden="true"
          className="mt-1.5 text-[0.5625rem] font-normal uppercase tracking-[0.28em] text-current opacity-80"
        >
          {SITE_TAGLINE}
        </span>
      ) : null}
    </Link>
  );
}
