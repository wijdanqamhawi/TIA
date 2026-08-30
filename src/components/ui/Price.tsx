import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils/cn";
import type { OfferStatus } from "@/lib/domain/catalog/offer";

export type PriceProps = {
  minorUnits: number;
  locale: string;
  currency?: string;
  className?: string;
};

export function Price({ minorUnits, locale, currency, className }: PriceProps) {
  return (
    <span className={cn("font-semibold text-brand-burgundy", className)}>
      {formatCurrency(minorUnits, locale, currency)}
    </span>
  );
}

export type OfferPriceProps = {
  /** The regular/original price (always present, spec FR-118). */
  price: number;
  /** `salePrice` while `offerStatus === "ACTIVE"`, otherwise identical to `price`. */
  effectivePrice: number;
  offerStatus: OfferStatus;
  locale: string;
  currency?: string;
  className?: string;
  /** Labels for the visually-hidden original/sale-price context (spec FR-118, accessibility). */
  originalPriceLabel?: string;
  salePriceLabel?: string;
};

/**
 * Renders the crossed-out regular price + prominent sale price when a
 * product's derived offer status is `ACTIVE` (spec FR-118, SC-028) — the
 * one place this exact pair of numbers is displayed together, reused by
 * `ProductCard`, `QuickView`, the product detail page, and `CartLineItem`
 * so every surface renders identical offer pricing for the same product at
 * the same moment. Falls back to a plain `<Price>` for any other offer
 * status (Disabled/Scheduled/Expired) — those never show a sale price
 * (spec FR-116).
 */
export function OfferPrice({
  price,
  effectivePrice,
  offerStatus,
  locale,
  currency,
  className,
  originalPriceLabel = "Original price",
  salePriceLabel = "Sale price",
}: OfferPriceProps) {
  if (offerStatus !== "ACTIVE") {
    return <Price minorUnits={price} locale={locale} currency={currency} className={className} />;
  }

  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-2", className)}>
      <span className="sr-only">
        {originalPriceLabel}: {formatCurrency(price, locale, currency)}. {salePriceLabel}:{" "}
        {formatCurrency(effectivePrice, locale, currency)}.
      </span>
      <span aria-hidden="true" className="text-sm font-normal text-text-primary/50 line-through">
        {formatCurrency(price, locale, currency)}
      </span>
      <span aria-hidden="true" className="font-semibold text-brand-burgundy">
        {formatCurrency(effectivePrice, locale, currency)}
      </span>
    </span>
  );
}
