"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Arms a one-time, CSS-driven entrance for the `[data-reveal]` children
 * inside it (see "Editorial reveal" in globals.css).
 *
 * The state lives in a `data-reveal-root` attribute set directly on the
 * element — `armed` once JavaScript is running, `revealed` once the block
 * scrolls into view — so it costs no re-render. Server markup carries no
 * attribute, which means content is fully visible without JavaScript and
 * is only ever hidden by a script that is already able to show it again.
 * With reduced motion (or no IntersectionObserver) it reveals at once.
 */
export function RevealOnView({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || typeof IntersectionObserver === "undefined") {
      el.dataset.revealRoot = "revealed";
      return;
    }

    el.dataset.revealRoot = "armed";
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          el.dataset.revealRoot = "revealed";
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
