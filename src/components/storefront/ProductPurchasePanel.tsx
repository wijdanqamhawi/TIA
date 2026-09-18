"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { OfferPrice } from "@/components/ui/Price";
import { FormError } from "@/components/ui/FormError";
import { QuantitySelector } from "./QuantitySelector";
import { resolveLocalizedString } from "@/types/localizedString";
import { isSoldOut } from "@/lib/domain/catalog/soldOut";
import type { OfferStatus } from "@/lib/domain/catalog/offer";
import { addCartItemAction } from "@/actions/cart.actions";
import type { ProductOption } from "@/types/product";
import { SWATCH_COLORS } from "@/lib/config/swatchColors";
import { useSelectedVariant } from "./product/SelectedVariantContext";

const KNOWN_CART_ISSUES = ["NOT_FOUND", "NOT_AVAILABLE", "SOLD_OUT", "INSUFFICIENT_STOCK", "INVALID_OPTION"] as const;

/**
 * Client-side purchase controls on the product detail page: option
 * selection, a stock-bounded quantity stepper, and Add to Cart, which calls
 * the real `addCartItemAction` (Phase 6).
 *
 * `CartItem.selectedOption` is a single `{ optionKey, valueKey }` pair
 * (data-model.md) — a cart line supports exactly one option dimension, so
 * only the product's first `options` entry (e.g. "Color") is offered here
 * even if a product were to define more than one; that matches the
 * approved cart schema rather than inventing multi-dimension selection it
 * doesn't support.
 *
 * ── WHERE THE WISHLIST CONTROL LIVES ─────────────────────────────────────
 * The wishlist affordance on this page is the heart on the product image
 * (`ImageGallery`), matching the approved reference. That control owns the
 * whole interaction — real membership state, the add/remove toggle and the
 * guest redirect to `/login?next=…&intent=wishlist:<productId>` — so this
 * panel deliberately carries no second wishlist button for the same action.
 *
 * Sold Out (spec FR-015a) shows a badge and disables both the quantity
 * selector and Add to Cart — computed the same way as everywhere else in
 * the catalog (`isSoldOut`, `lib/domain/catalog/soldOut.ts`), never a
 * separate check invented for this page.
 */
export function ProductPurchasePanel({
  productId,
  price,
  effectivePrice,
  offerStatus,
  stock,
  options,
  locale,
  description,
}: {
  productId: string;
  price: number;
  effectivePrice: number;
  offerStatus: OfferStatus;
  stock: number;
  options: ProductOption[];
  locale: string;
  /** The product's real description, shown under the price as in the reference. */
  description?: string;
}) {
  const t = useTranslations("Common");
  const tProduct = useTranslations("Product");
  const tCart = useTranslations("Cart");
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  // The selected value is shared with the gallery through context so that
  // choosing a colour also swaps the photography (see
  // `SelectedVariantContext`). It is pre-selected with the product's first
  // option value by the provider, as in the approved reference ("Color:
  // Gold" on arrival) — leaving it unset rendered Add to Cart in its
  // disabled grey state on load for any product with options, which read as
  // broken. Changing colour never resets the quantity below.
  const { selectedValueKey, setSelectedValueKey } = useSelectedVariant();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const soldOut = isSoldOut({ stock });

  const option = options[0] ?? null;
  const hasChosenRequiredOption = !option || Boolean(selectedValueKey);
  const canAddToCart = !soldOut && hasChosenRequiredOption;

  const selectedValue = option?.values.find((value) => value.key === selectedValueKey) ?? null;
  const selectedLabel = selectedValue ? resolveLocalizedString(selectedValue.label, locale) : null;
  // Swatches only for a colour option this component knows how to paint.
  const asSwatches = option?.key === "color" && option.values.some((value) => Boolean(SWATCH_COLORS[value.key]));

  function handleAddToCart() {
    setError(null);
    startTransition(async () => {
      const result = await addCartItemAction({
        productId,
        selectedOption: option && selectedValueKey ? { optionKey: option.key, valueKey: selectedValueKey } : null,
        quantity,
      });

      if (!result.ok) {
        const code = result.error.code;
        if (code === "INSUFFICIENT_STOCK") {
          setError(tCart("issues.INSUFFICIENT_STOCK", { stock }));
        } else if ((KNOWN_CART_ISSUES as readonly string[]).includes(code)) {
          setError(tCart(`issues.${code}` as "issues.SOLD_OUT"));
        } else {
          setError(t("error"));
        }
        return;
      }

      router.refresh();
    });
  }

  // The reference's right column runs the full height of the gallery plate:
  // price, description, rule, options and the purchase row are spaced apart
  // rather than stacked tightly at the top, which is what removes the
  // trailing void under the column without stretching any single element.
  return (
    <div className="flex flex-col gap-5">
      <OfferPrice
        price={price}
        effectivePrice={effectivePrice}
        offerStatus={offerStatus}
        locale={locale}
        className="text-[1.875rem]"
        originalPriceLabel={t("originalPrice")}
        salePriceLabel={t("salePrice")}
      />

      {soldOut ? (
        <Badge variant="danger" className="w-fit">
          {t("soldOut")}
        </Badge>
      ) : offerStatus === "ACTIVE" ? (
        <Badge variant="gold" className="w-fit">
          {t("onSale")}
        </Badge>
      ) : null}

      {/* The reference sets the description directly under the price, above
          the divider — not at the foot of the page. */}
      {description ? (
        <p id="product-description" className="scroll-mt-28 max-w-[27rem] text-[0.8125rem] leading-[1.85] text-text-secondary">
          {description}
        </p>
      ) : null}

      <span aria-hidden="true" className="mt-1 block h-px w-full bg-hairline" />

      {option ? (
        <div className="flex flex-col gap-2">
          {/* "Color: Gold" — the option's own localized name, followed by
              the selected value's localized label once one is chosen. Both
              strings come from the product's real option data; neither is
              hardcoded here. */}
          <span className="text-[0.8125rem] text-text-primary">
            <span className="font-medium">{resolveLocalizedString(option.name, locale)}</span>
            {selectedLabel ? <span className="text-text-secondary">: {selectedLabel}</span> : null}
          </span>
          <div className="flex flex-wrap gap-2.5">
            {option.values.map((value) => {
              const isSelected = selectedValueKey === value.key;
              const label = resolveLocalizedString(value.label, locale);
              const swatch = asSwatches ? SWATCH_COLORS[value.key] : null;

              // Circular swatch for a colour option whose values this map
              // knows; any other option (or an unrecognised colour key)
              // keeps the original labelled button, so no product can ever
              // render a blank, unreadable circle.
              return swatch ? (
                <button
                  key={value.key}
                  type="button"
                  disabled={soldOut}
                  aria-pressed={isSelected}
                  aria-label={label}
                  title={label}
                  onClick={() => setSelectedValueKey(value.key)}
                  className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-burgundy disabled:cursor-not-allowed disabled:opacity-50 ${
                    isSelected ? "border-brand-gold" : "border-hairline-strong hover:border-text-primary"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="h-[1.375rem] w-[1.375rem] rounded-full border border-hairline"
                    style={{ background: swatch }}
                  />
                </button>
              ) : (
                <button
                  key={value.key}
                  type="button"
                  disabled={soldOut}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedValueKey(value.key)}
                  className={`min-h-9 border px-3.5 py-1.5 text-[0.8125rem] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    isSelected
                      ? "border-brand-burgundy bg-brand-burgundy text-text-on-dark"
                      : "border-hairline-strong text-text-primary hover:border-text-primary"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Quantity and Add to Cart share one row, as in the reference: a
          narrow stepper beside a wide navy action, both the same height and
          aligned on one baseline. */}
      <div className="mt-1 flex items-stretch gap-3.5">
        <div className="shrink-0">
          <QuantitySelector value={quantity} max={Math.max(stock, 1)} disabled={soldOut} onChange={setQuantity} />
        </div>
        <Button
          type="button"
          onClick={handleAddToCart}
          disabled={!canAddToCart || isPending}
          className="h-[3.25rem] min-h-[3.25rem] flex-1"
        >
          {soldOut ? t("soldOut") : t("addToCart")}
        </Button>
      </div>

      {!soldOut && stock <= 5 ? (
        <span className="text-xs text-text-secondary">{tProduct("lowStock", { count: stock })}</span>
      ) : null}

      <FormError message={error} />
    </div>
  );
}
