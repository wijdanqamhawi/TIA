"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { OfferPrice } from "@/components/ui/Price";
import { FormError } from "@/components/ui/FormError";
import { resolveLocalizedString } from "@/types/localizedString";
import { removeWishlistItemAction, moveWishlistItemToCartAction } from "@/actions/wishlist.actions";
import type { EnrichedWishlistItem } from "@/lib/domain/wishlist/wishlist.service";
import { resolveProductImage } from "@/lib/config/demoImages";

const KNOWN_MOVE_ERROR_CODES = ["SOLD_OUT", "NOT_AVAILABLE", "INSUFFICIENT_STOCK", "NOT_FOUND"] as const;

/**
 * A single wishlist entry (spec User Story 3): current live image/name/
 * price (crossed-out + sale price when an offer is `ACTIVE`), a SOLD OUT
 * badge, Remove, and Move to Cart. Every field shown is read live from
 * `products/{productId}` at render time — the wishlist document itself
 * never stores a price/stock/availability (data-model.md).
 *
 * A Sold Out item stays fully visible here — only Move to Cart is
 * disabled (this task's explicit requirement, spec FR-032); Remove always
 * works regardless of the item's current validity.
 */
export function WishlistItemCard({ item, locale }: { item: EnrichedWishlistItem; locale: string }) {
  const t = useTranslations("Wishlist");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const [isRemoving, startRemoveTransition] = useTransition();
  const [isMoving, startMoveTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const name = item.product ? resolveLocalizedString(item.product.name, locale) : null;
  const optionLabel = item.product?.optionLabel ? resolveLocalizedString(item.product.optionLabel, locale) : null;
  // Real uploaded photo wins; a seeded placeholder shows the demo image.
  const image = item.product
    ? { url: resolveProductImage(item.product.image?.url, item.productId).url, alt: item.product.image?.alt ?? "" }
    : null;

  const canMoveToCart = Boolean(item.product) && !item.issue && !item.product!.isSoldOut && item.product!.availability;

  function handleRemove() {
    startRemoveTransition(async () => {
      await removeWishlistItemAction({ productId: item.productId, selectedOption: item.selectedOption });
      router.refresh();
    });
  }

  function handleMoveToCart() {
    setError(null);
    startMoveTransition(async () => {
      const result = await moveWishlistItemToCartAction({
        productId: item.productId,
        selectedOption: item.selectedOption,
      });
      if (!result.ok) {
        const code = result.error.code;
        if ((KNOWN_MOVE_ERROR_CODES as readonly string[]).includes(code)) {
          setError(
            t(`moveError.${code}` as "moveError.SOLD_OUT", { stock: item.product?.stock ?? 0 }),
          );
        } else {
          setError(tCommon("error"));
        }
        return;
      }
      router.refresh();
    });
  }

  const isBusy = isRemoving || isMoving;

  return (
    <div
      className={`group flex flex-col ${isBusy ? "opacity-60" : ""}`}
      aria-busy={isBusy}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-brand-beige">
        {item.product ? (
          <Link href={`/shop/${item.product.slug}`} className="block h-full w-full">
            {image ? (
              <Image
                src={image.url}
                alt={image.alt || name || ""}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className={`object-cover ${item.product.isSoldOut ? "opacity-60" : ""}`}
              />
            ) : null}
          </Link>
        ) : null}

        <div className="absolute start-3 top-3 flex flex-col items-start gap-1.5">
          {item.product?.isSoldOut ? <Badge variant="danger">{tCommon("soldOut")}</Badge> : null}
          {!item.product?.isSoldOut && item.product?.offerStatus === "ACTIVE" ? (
            <Badge variant="burgundy">{tCommon("onSale")}</Badge>
          ) : null}
          {item.issue === "NOT_FOUND" || item.issue === "INVALID_OPTION" ? (
            <Badge variant="neutral">{item.issue === "NOT_FOUND" ? t("unavailable") : t("invalidOption")}</Badge>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col items-start gap-2 pt-4">
        {item.product && name ? (
          <Link href={`/shop/${item.product.slug}`} className="link-underline text-sm font-medium leading-snug text-text-primary transition-colors hover:text-brand-burgundy focus-visible:outline-none">
            {name}
          </Link>
        ) : (
          <span className="font-medium text-text-primary/60">{t("unavailable")}</span>
        )}
        {optionLabel ? <span className="text-sm text-text-primary/70">{t("option")}: {optionLabel}</span> : null}
        {item.product ? (
          <OfferPrice
            price={item.product.originalPrice}
            effectivePrice={item.product.price}
            offerStatus={item.product.offerStatus}
            locale={locale}
            className="text-sm"
            originalPriceLabel={tCommon("originalPrice")}
            salePriceLabel={tCommon("salePrice")}
          />
        ) : null}

        <FormError message={error} />

        <div className="mt-auto flex w-full flex-col gap-2 pt-2 sm:flex-row">
          <Button
            type="button"
            size="sm"
            onClick={handleMoveToCart}
            disabled={!canMoveToCart || isBusy}
            className="flex-1"
          >
            {item.product?.isSoldOut ? tCommon("soldOut") : t("moveToCart")}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={handleRemove} disabled={isBusy}>
            {t("remove")}
          </Button>
        </div>
      </div>
    </div>
  );
}
