"use client";

import { useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { Price, OfferPrice } from "@/components/ui/Price";
import { FormError } from "@/components/ui/FormError";
import { QuantitySelector } from "./QuantitySelector";
import { resolveLocalizedString } from "@/types/localizedString";
import { removeCartItemAction, updateCartItemQuantityAction } from "@/actions/cart.actions";
import type { EnrichedCartLine } from "@/lib/domain/cart/cart.service";
import { resolveProductImage } from "@/lib/config/demoImages";

/**
 * A single cart line (spec FR-050d): a table row at `md`+, a stacked card
 * below `md` — never a wide desktop-only table that breaks on mobile.
 * Resolves its localized option label from the live product (T099) and
 * surfaces a clear, localized warning when the line has gone stale
 * (Sold Out, unavailable, insufficient stock, or an invalid option) —
 * the item stays visible and removable, never silently dropped.
 */
export function CartLineItem({ line, locale }: { line: EnrichedCartLine; locale: string }) {
  const t = useTranslations("Cart");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const name = line.product ? resolveLocalizedString(line.product.name, locale) : null;
  const optionLabel = line.product?.optionLabel ? resolveLocalizedString(line.product.optionLabel, locale) : null;
  // Real uploaded photo wins; a seeded placeholder shows the demo image.
  const image = line.product
    ? { url: resolveProductImage(line.product.image?.url, line.productId).url, alt: line.product.image?.alt ?? "" }
    : null;

  function handleQuantityChange(nextQuantity: number) {
    startTransition(async () => {
      await updateCartItemQuantityAction({
        productId: line.productId,
        selectedOption: line.selectedOption,
        quantity: nextQuantity,
      });
      router.refresh();
    });
  }

  function handleRemove() {
    startTransition(async () => {
      await removeCartItemAction({ productId: line.productId, selectedOption: line.selectedOption });
      router.refresh();
    });
  }

  const issueMessage = line.issue
    ? line.issue === "INSUFFICIENT_STOCK" && line.product
      ? t("issues.INSUFFICIENT_STOCK", { stock: line.product.stock })
      : t(`issues.${line.issue}`)
    : null;

  return (
    <div
      className={`flex flex-col gap-3 border-b border-border-luxury py-4 sm:flex-row sm:items-center sm:gap-4 ${isPending ? "opacity-60" : ""}`}
      aria-busy={isPending}
    >
      <div className="flex gap-3 sm:flex-1 sm:items-center">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-none bg-brand-beige">
          {image ? (
            <Image src={image.url} alt={image.alt || name || ""} fill sizes="96px" className="object-cover" />
          ) : null}
        </div>
        <div className="flex flex-col gap-1">
          {name && line.product ? (
            <Link href={`/shop/${line.product.slug}`} className="link-underline w-fit font-medium text-text-primary transition-colors hover:text-brand-burgundy focus-visible:outline-none">
              {name}
            </Link>
          ) : (
            <span className="font-medium text-text-primary/60">{tCommon("empty")}</span>
          )}
          {optionLabel ? (
            <span className="text-sm text-text-primary/70">
              {t("option")}: {optionLabel}
            </span>
          ) : null}
          {line.product ? (
            <OfferPrice
              price={line.product.originalPrice}
              effectivePrice={line.product.price}
              offerStatus={line.product.offerStatus}
              locale={locale}
              className="text-sm sm:hidden"
              originalPriceLabel={tCommon("originalPrice")}
              salePriceLabel={tCommon("salePrice")}
            />
          ) : null}
          <FormError message={issueMessage} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 sm:justify-end sm:gap-6">
        {line.product ? (
          <OfferPrice
            price={line.product.originalPrice}
            effectivePrice={line.product.price}
            offerStatus={line.product.offerStatus}
            locale={locale}
            className="hidden w-24 text-sm sm:inline-flex"
            originalPriceLabel={tCommon("originalPrice")}
            salePriceLabel={tCommon("salePrice")}
          />
        ) : (
          <span className="hidden w-24 sm:block" />
        )}

        <QuantitySelector
          value={line.quantity}
          max={line.product ? Math.max(line.product.stock, 1) : 1}
          disabled={isPending || !line.product}
          onChange={handleQuantityChange}
        />

        <span className="w-20 text-end font-medium text-text-primary">
          {line.product ? <Price minorUnits={line.lineTotal} locale={locale} /> : "—"}
        </span>

        <button
          type="button"
          onClick={handleRemove}
          disabled={isPending}
          aria-label={t("remove")}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-text-primary/60 transition-colors hover:bg-brand-beige hover:text-brand-burgundy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-burgundy disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash2 aria-hidden="true" size={18} />
        </button>
      </div>
    </div>
  );
}
