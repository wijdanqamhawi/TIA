"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";
import { resolveLocalizedString } from "@/types/localizedString";
import { swatchFill } from "@/lib/config/swatchColors";
import type { ColorVariant } from "@/lib/domain/catalog/colorVariants";

/**
 * The catalogue card's colour picker: a localized "3 Colors" count above a
 * row of small circular swatches, one per photographed colour variant of
 * the SAME product (see `getColorVariants`).
 *
 * ── IT IS A PREVIEW, NOT A PURCHASE CONTROL ──────────────────────────────
 * Choosing a swatch only changes which of the product's own photographs the
 * card shows. No cart, wishlist or inventory state is touched, and no
 * navigation happens — the shopper stays exactly where they are. The real
 * option selection that reaches the cart still lives on the detail page /
 * Quick View, on the existing architecture.
 *
 * The count is rendered from `variants.length` through an ICU plural, so a
 * two-colour product reads "2 Colors" and an Arabic shopper gets the proper
 * Arabic plural form — nothing is hardcoded per product or per language.
 *
 * ── CLICKS MUST NOT REACH THE CARD ───────────────────────────────────────
 * The card's image and title are links to the detail page. These buttons
 * are siblings rather than descendants of those links, but they sit inside
 * the same hover/press surface, so `stopPropagation` is applied to keep a
 * swatch press from being read as "open this product". Keyboard use is
 * untouched: each swatch is a real focusable `<button>` with `aria-pressed`
 * and the value's localized label as its accessible name and tooltip.
 */
export function ColorSwatches({
  variants,
  selectedKey,
  onSelect,
  locale,
  className,
  labelClassName,
}: {
  variants: ColorVariant[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  locale: string;
  className?: string;
  /** Overrides the count label's colour on the homepage's dark editorial band. */
  labelClassName?: string;
}) {
  const t = useTranslations("Common");
  if (variants.length === 0) return null;

  return (
    <div className={cn("flex flex-col items-start gap-1", className)}>
      <span
        className={cn(
          "text-[0.625rem] uppercase tracking-[0.16em] rtl:text-[0.6875rem] rtl:normal-case rtl:tracking-normal",
          // A caller's colour *replaces* the default rather than joining it:
          // `cn` is a plain join, so two competing `color` utilities would be
          // resolved by stylesheet order instead of by the caller's intent.
          labelClassName ?? "text-text-secondary",
        )}
      >
        {t("colorCount", { count: variants.length })}
      </span>
      {/* A 28px tap target holds the 14px disc — comfortably tappable on a
          390px screen while the visible swatch stays small and restrained.
          `flex-wrap` means a product with many colours grows a second row
          instead of widening the card or overflowing the grid. */}
      <div className="-ms-1 flex flex-wrap items-center gap-0.5">
        {variants.map((variant) => {
          const label = resolveLocalizedString(variant.label, locale);
          const isSelected = selectedKey === variant.key;
          return (
            <button
              key={variant.key}
              type="button"
              aria-label={label}
              aria-pressed={isSelected}
              title={label}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onSelect(variant.key);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-burgundy"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "block h-3.5 w-3.5 rounded-full border transition-[box-shadow,border-color] duration-200 ease-luxury",
                  isSelected
                    ? "border-brand-gold shadow-[0_0_0_1px_var(--color-brand-gold)]"
                    : "border-hairline-strong",
                )}
                style={{ background: swatchFill(variant.key) }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
