import type { ReactNode } from "react";

/**
 * The chrome around the Navbar's contents.
 *
 * Per the approved reference the header is a slim, solid warm-white bar on
 * every route — including the homepage, where the hero begins *below* it
 * rather than running behind it. Navy wordmark, navy links, navy icons, one
 * hairline, no shadow.
 *
 * The navy announcement bar is rendered by `Navbar` as this element's first
 * child, so the two travel together as one sticky unit.
 */
export function NavbarShell({ children }: { children: ReactNode }) {
  return (
    <header
      // Deliberately *without* `backdrop-filter`: a backdrop filter makes
      // the header the containing block for `position: fixed` descendants,
      // which clipped the mobile/tablet menu drawer (rendered inside this
      // header) to the header's own height instead of the viewport.
      className="sticky top-0 z-40 bg-brand-ivory text-text-primary"
    >
      {children}
    </header>
  );
}
