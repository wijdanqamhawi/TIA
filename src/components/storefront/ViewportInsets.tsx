"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

/**
 * The shared bottom-inset coordination mechanism (research.md §30).
 *
 * Every fixed element anchored to the bottom of the viewport — the PWA
 * install banner (T197), a future cookie notice, a future mobile sticky
 * Add-to-Cart bar — registers how much of the bottom edge it occupies.
 * `FloatingWhatsApp` (T207) then positions itself *above* whatever is
 * currently reserved, rather than every element independently hardcoding
 * a pixel offset and hoping they never collide.
 *
 * This is what actually guarantees non-overlap as new fixed UI is added
 * later: a new bottom-anchored element only has to call
 * `useReserveBottomInset` to be accounted for automatically.
 *
 * The reserved value is the **maximum** (not the sum) of all registrations,
 * because each registrant reports "the bottom N pixels of the viewport are
 * occupied by me" — two elements overlapping the same band reserve that
 * band once, not twice.
 */

type ViewportInsetsContextValue = {
  reservedBottom: number;
  register: (id: string, height: number) => void;
  unregister: (id: string) => void;
};

const ViewportInsetsContext = createContext<ViewportInsetsContextValue | null>(null);

export function ViewportInsetsProvider({ children }: { children: React.ReactNode }) {
  const [insets, setInsets] = useState<Record<string, number>>({});

  const register = useCallback((id: string, height: number) => {
    setInsets((prev) => (prev[id] === height ? prev : { ...prev, [id]: height }));
  }, []);

  const unregister = useCallback((id: string) => {
    setInsets((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const reservedBottom = useMemo(() => {
    const values = Object.values(insets);
    return values.length === 0 ? 0 : Math.max(...values);
  }, [insets]);

  const value = useMemo(
    () => ({ reservedBottom, register, unregister }),
    [reservedBottom, register, unregister],
  );

  return <ViewportInsetsContext.Provider value={value}>{children}</ViewportInsetsContext.Provider>;
}

/** How many pixels of the viewport's bottom edge are currently occupied by fixed UI. */
export function useReservedBottomInset(): number {
  return useContext(ViewportInsetsContext)?.reservedBottom ?? 0;
}

/**
 * Registers a bottom-anchored fixed element's occupied height, measured
 * live via `ResizeObserver` so a wrapping/growing element (e.g. the
 * install banner in Arabic, or on a narrow phone) reserves its real
 * height rather than an assumed one.
 *
 * `bottomOffsetPx` is the element's own distance from the viewport bottom
 * (e.g. `16` for a `bottom-4` element) — the reserved band is that offset
 * plus the measured height.
 *
 * Safe to call when the provider isn't mounted (returns an inert ref), so
 * a component using it never hard-depends on the provider being present.
 */
export function useReserveBottomInset(id: string, active: boolean, bottomOffsetPx = 0) {
  const context = useContext(ViewportInsetsContext);
  const ref = useRef<HTMLDivElement | null>(null);
  const register = context?.register;
  const unregister = context?.unregister;

  useEffect(() => {
    if (!register || !unregister) return;
    if (!active || !ref.current) {
      unregister(id);
      return;
    }

    const node = ref.current;
    const measure = () => register(id, node.getBoundingClientRect().height + bottomOffsetPx);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => {
      observer.disconnect();
      unregister(id);
    };
  }, [id, active, bottomOffsetPx, register, unregister]);

  return ref;
}
