"use client";

import type { ReactNode } from "react";
import { Link, usePathname } from "@/lib/i18n/navigation";

/**
 * One of the header's four action icons, with its hover and active states.
 *
 * Presentation and route-matching only — the destination, the icon, the
 * `aria-label` and any badge stay exactly where they were in `Navbar`.
 * `usePathname` comes from next-intl's navigation, so it is already
 * stripped of the locale prefix: `/wishlist` matches under both `/en` and
 * `/ar` with no locale-specific branching.
 *
 * The circle is its own 40px element rather than a background on the 44px
 * target. Painting it on the target itself produced a 44px disc flush with
 * its own hit area, which read as a faint wash rather than a deliberate
 * shape; inset by 2px it has an edge you can see. It sits first in the DOM
 * and is `pointer-events-none`, so the icon and `CartBadge` paint over it
 * and keep positioning themselves against the link exactly as before.
 *
 * Hover is gated behind `@media (hover: hover)` so a touch device never
 * keeps a "stuck" hover after a tap; the active state is independent of
 * hover, so it persists once the pointer leaves and hovering a neighbour
 * cannot clear it.
 */
export function HeaderActionLink({
  href,
  label,
  activePath,
  className = "",
  children,
}: {
  href: string;
  label: string;
  /**
   * The locale-less route this icon represents. Active on it and on its
   * sub-routes (`/account` also covers `/account/orders`). Omitted for an
   * icon that has no state to reflect.
   */
  activePath?: string;
  className?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isActive = !!activePath && (pathname === activePath || pathname.startsWith(`${activePath}/`));

  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={isActive ? "page" : undefined}
      className={[
        // Unchanged geometry: same 44px target, same rounding, same focus
        // ring. Only colour and the circle's opacity move, so nothing can
        // shift.
        // `isolate`: keeps the `-z-10` disc inside this link's own stacking
        // context, so it can never slip behind the header's background.
        "group relative isolate flex min-h-11 min-w-11 items-center justify-center rounded-full",
        "transition-[color,opacity] duration-[180ms] ease-luxury",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current",
        // The icon itself: lucide draws with `currentColor`, so the link's
        // colour is what the stroke follows.
        isActive ? "text-text-primary opacity-100" : "text-current opacity-85",
        "[@media(hover:hover)]:hover:text-text-primary [@media(hover:hover)]:hover:opacity-100",
        className,
      ].join(" ")}
    >
      <span
        aria-hidden="true"
        className={[
          // `-z-10`: an absolutely positioned child paints above static
          // siblings whatever the DOM order, so without this the disc
          // covered the icon completely — a grey circle with nothing in it.
          "pointer-events-none absolute left-1/2 top-1/2 -z-10 size-10 -translate-x-1/2 -translate-y-1/2 rounded-full",
          "bg-brand-cream transition-opacity duration-[180ms] ease-luxury",
          isActive ? "opacity-100" : "opacity-0",
          "[@media(hover:hover)]:group-hover:opacity-100",
        ].join(" ")}
      />
      {children}
      {isActive ? (
        // The second, non-colour cue. Absolutely positioned inside the
        // existing 44px target — above the 18px icon, within the padding
        // that is already there — so the header's height and every
        // neighbour stay exactly where they were. Centred with a
        // translation, which is direction-agnostic for RTL.
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1 h-0 w-0 -translate-x-1/2 border-x-[3px] border-t-[4px] border-x-transparent border-t-brand-burgundy"
        />
      ) : null}
    </Link>
  );
}
