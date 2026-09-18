"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type SelectedVariant = {
  /** The selected option value's stable key, or null when the product has no options. */
  selectedValueKey: string | null;
  setSelectedValueKey: (key: string | null) => void;
};

/**
 * The shopper's selected option value, shared across the product detail
 * page's two columns.
 *
 * ── WHY A CONTEXT ────────────────────────────────────────────────────────
 * The swatches live in `ProductPurchasePanel` (right column) and the
 * photography lives in `ImageGallery` (left column). They are siblings
 * rendered by a Server Component with other markup between them, so the
 * selection cannot simply be lifted into a shared parent without
 * restructuring the approved layout. A small client context lets both read
 * the same state while the page itself stays a Server Component.
 *
 * The default value is a no-op with nothing selected, so `ImageGallery`
 * still renders correctly anywhere it is used without a provider.
 */
const SelectedVariantContext = createContext<SelectedVariant>({
  selectedValueKey: null,
  setSelectedValueKey: () => {},
});

export function SelectedVariantProvider({
  initialValueKey = null,
  children,
}: {
  /** Pre-selected on arrival — the product's first option value. */
  initialValueKey?: string | null;
  children: ReactNode;
}) {
  const [selectedValueKey, setSelectedValueKey] = useState<string | null>(initialValueKey);
  const value = useMemo(() => ({ selectedValueKey, setSelectedValueKey }), [selectedValueKey]);
  return <SelectedVariantContext.Provider value={value}>{children}</SelectedVariantContext.Provider>;
}

export function useSelectedVariant(): SelectedVariant {
  return useContext(SelectedVariantContext);
}
