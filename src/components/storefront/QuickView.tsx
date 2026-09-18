"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { OfferPrice } from "@/components/ui/Price";
import { FormError } from "@/components/ui/FormError";
import { Link } from "@/lib/i18n/navigation";
import { resolveLocalizedString } from "@/types/localizedString";
import { isSoldOut } from "@/lib/domain/catalog/soldOut";
import { addCartItemAction } from "@/actions/cart.actions";
import { Badge } from "@/components/ui/Badge";
import { resolveProductImage } from "@/lib/config/demoImages";
import type { ProductCardProduct } from "./ProductCard";

const KNOWN_CART_ISSUES = ["NOT_FOUND", "NOT_AVAILABLE", "SOLD_OUT", "INSUFFICIENT_STOCK", "INVALID_OPTION"] as const;

/**
 * A lightweight in-page preview dialog for a product (spec: ProductCard
 * quick view). A product with options has no picker here (no room in this
 * compact preview) — its Add to Cart links to the full detail page
 * instead, where `ProductPurchasePanel` handles option selection. Sold
 * Out (spec FR-015a) disables Add to Cart here exactly as it does on the
 * card itself — the product stays fully viewable.
 */
export function QuickView({
  product,
  locale,
  open,
  onClose,
}: {
  product: ProductCardProduct;
  locale: string;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("Common");
  const tCart = useTranslations("Cart");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const name = resolveLocalizedString(product.name, locale);
  const image = resolveProductImage(product.images[0]?.url, product.id);
  const soldOut = isSoldOut(product);
  const hasOptions = product.options.length > 0;

  function handleAddToCart() {
    setError(null);
    startTransition(async () => {
      const result = await addCartItemAction({ productId: product.id, quantity: 1 });
      if (!result.ok) {
        const code = result.error.code;
        if (code === "INSUFFICIENT_STOCK") {
          setError(tCart("issues.INSUFFICIENT_STOCK", { stock: product.stock }));
        } else if ((KNOWN_CART_ISSUES as readonly string[]).includes(code)) {
          setError(tCart(`issues.${code}` as "issues.SOLD_OUT"));
        } else {
          setError(t("error"));
        }
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <Dialog open={open} onClose={onClose} title={name} className="w-[min(92vw,42rem)]">
      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="relative aspect-square w-full shrink-0 overflow-hidden rounded-none bg-brand-beige sm:w-60">
          <Image
            src={image.url}
            alt={product.images[0]?.alt || name}
            fill
            sizes="240px"
            className="object-cover object-center"
          />
        </div>
        <div className="flex flex-1 flex-col items-start gap-4">
          <OfferPrice
            price={product.price}
            effectivePrice={product.effectivePrice}
            offerStatus={product.offerStatus}
            locale={locale}
            className="text-2xl"
            originalPriceLabel={t("originalPrice")}
            salePriceLabel={t("salePrice")}
          />
          {soldOut ? (
            <Badge variant="danger">{t("soldOut")}</Badge>
          ) : product.offerStatus === "ACTIVE" ? (
            <Badge variant="burgundy">{t("onSale")}</Badge>
          ) : null}
          <FormError message={error} />
          <div className="mt-auto flex w-full flex-col gap-3 pt-2 sm:flex-row">
            {hasOptions ? (
              <Link href={`/shop/${product.slug}`} onClick={onClose} className="flex-1">
                <Button type="button" disabled={soldOut} className="w-full">
                  {soldOut ? t("soldOut") : t("viewDetails")}
                </Button>
              </Link>
            ) : (
              <Button type="button" onClick={handleAddToCart} disabled={soldOut || isPending} className="flex-1">
                {soldOut ? t("soldOut") : t("addToCart")}
              </Button>
            )}
            <Link href={`/shop/${product.slug}`} onClick={onClose}>
              <Button type="button" variant="outline" className="w-full">
                {t("viewDetails")}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
