"use client";

import { useRef, type CSSProperties, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * A horizontal snap-scrolling row with the reference's two minimal circular
 * arrows, one on each outer edge.
 *
 * The row itself is the scroll container, so it remains fully usable with no
 * JavaScript (touch, trackpad and keyboard all scroll it natively) — the
 * arrows are a pointer convenience layered on top, which is why they are
 * hidden below `lg` where touch scrolling is the natural gesture.
 *
 * Direction-aware: `scrollBy` is signed against the document's writing
 * direction, so "next" always means "further along the reading order" in
 * both English and Arabic.
 *
 * Purely presentational — it renders whatever children it is given and
 * introduces no data access, state or navigation of its own.
 */
export function CarouselRow({
  children,
  previousLabel,
  nextLabel,
  className,
  style,
}: {
  children: ReactNode;
  previousLabel: string;
  nextLabel: string;
  className?: string;
  /** Passed straight to the scrolling list — used to set its column count. */
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLUListElement>(null);

  function scroll(direction: 1 | -1) {
    const el = ref.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === "rtl";
    el.scrollBy({ left: direction * (rtl ? -1 : 1) * el.clientWidth * 0.8, behavior: "smooth" });
  }

  const ARROW =
    "absolute top-[38%] z-10 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border border-hairline bg-brand-ivory text-text-primary shadow-elev-1 transition-colors hover:bg-brand-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-burgundy lg:flex";

  return (
    // `min-w-0` matters: without a definite width the scrolling list below
    // resolves to its *content* width, and `overflow-x-auto` then has
    // nothing to scroll within — the row pushes the document wider instead
    // of scrolling inside it.
    <div className="relative min-w-0">
      <button type="button" onClick={() => scroll(-1)} aria-label={previousLabel} className={`${ARROW} -start-4 xl:-start-5`}>
        <ChevronLeft aria-hidden="true" size={18} strokeWidth={1.5} className="rtl:-scale-x-100" />
      </button>

      <ul ref={ref} className={className} style={style}>
        {children}
      </ul>

      <button type="button" onClick={() => scroll(1)} aria-label={nextLabel} className={`${ARROW} -end-4 xl:-end-5`}>
        <ChevronRight aria-hidden="true" size={18} strokeWidth={1.5} className="rtl:-scale-x-100" />
      </button>
    </div>
  );
}
