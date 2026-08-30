"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { OfferPrice } from "@/components/ui/Price";
import { FormError } from "@/components/ui/FormError";
import { QuantitySelector } from "./QuantitySelector";
import { resolveLocalizedString } from "@/types/localizedString";
import { isSoldOut } from "@/lib/domain/catalog/soldOut";
import type { OfferStatus } from "@/lib/domain/catalog/offer";
import { addCartItemAction } from "@/actions/cart.actions";
import { addWishlistItemAction } from "@/actions/wishlist.actions";
import { buildWishlistIntent } from "@/lib/domain/wishlist/wishlist-intent";
import type { ProductOption } from "@/types/product";

const KNOWN_CART_ISSUES = ["NOT_FOUND", "NOT_AVAILABLE", "SOLD_OUT", "INSUFFICIENT_STOCK", "INVALID_OPTION"] as const;

/**
 * Client-side purchase controls on the product detail page: option
 * selection, a stock-bounded quantity stepper, Add to Cart, and Add to
 * Wishlist. Add to Cart calls the real `addCartItemAction` (Phase 6).
 *
 * `CartItem.selectedOption` is a single `{ optionKey, valueKey }` pair
 * (data-model.md) — a cart line supports exactly one option dimension, so
 * only the product's first `options` entry (e.g. "Color") is offered here
 * even if a product were to define more than one; that matches the
 * approved cart schema rather than inventing multi-dimension selection it
 * doesn't support. Add to Wishlist uses the exact same selected-option
 * value as Add to Cart and is disabled under the same `canAddToCart`
 * condition (an option-bearing product requires a selection first) — a
 * signed-in customer's click adds directly; a guest is redirected to
 * `/login?next=<path>&intent=wishlist:<productId>[:optionKey:valueKey]`
 * (spec FR-033a, research.md §7).
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
}: {
  productId: string;
  price: number;
  effectivePrice: number;
  offerStatus: OfferStatus;
  stock: number;
  options: ProductOption[];
  locale: string;
}) {
  const t = useTranslations("Common");
  const tProduct = useTranslations("Product");
  const tCart = useTranslations("Cart");
  const router = useRouter();
  const pathname = usePathname();
  const [quantity, setQuantity] = useState(1);
  const [selectedValueKey, setSelectedValueKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [wishlistPending, startWishlistTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [wishlistError, setWishlistError] = useState<string | null>(null);
  const soldOut = isSoldOut({ stock });

  const option = options[0] ?? null;
  const hasChosenRequiredOption = !option || Boolean(selectedValueKey);
  const canAddToCart = !soldOut && hasChosenRequiredOption;
  const selectedOption = option && selectedValueKey ? { optionKey: option.key, valueKey: selectedValueKey } : null;

  function handleAddToWishlist() {
    setWishlistError(null);
    startWishlistTransition(async () => {
      const result = await addWishlistItemAction({ productId, selectedOption });
      if (!result.ok) {
        if (result.error.code === "UNAUTHENTICATED") {
          const intent = buildWishlistIntent(productId, selectedOption);
          router.push(`/${locale}/login?next=${encodeURIComponent(pathname)}&intent=${encodeURIComponent(intent)}`);
          return;
        }
        setWishlistError(t("error"));
        return;
      }
      router.refresh();
    });
  }

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

  return (
    <div className="flex flex-col gap-4">
      <OfferPrice
        price={price}
        effectivePrice={effectivePrice}
        offerStatus={offerStatus}
        locale={locale}
        className="text-2xl"
        originalPriceLabel={t("originalPrice")}
        salePriceLabel={t("salePrice")}
      />
      {soldOut ? (
        <Badge variant="danger">{t("soldOut")}</Badge>
      ) : offerStatus === "ACTIVE" ? (
        <Badge variant="burgundy">{t("onSale")}</Badge>
      ) : null}

      {option ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text-primary">
            {resolveLocalizedString(option.name, locale)}
          </span>
          <div className="flex flex-wrap gap-2">
            {option.values.map((value) => {
              const isSelected = selectedValueKey === value.key;
              return (
                <button
                  key={value.key}
                  type="button"
                  disabled={soldOut}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedValueKey(value.key)}
                  className={`min-h-10 rounded-md border px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50 ${
                    isSelected
                      ? "border-brand-burgundy bg-brand-burgundy text-text-on-dark"
                      : "border-border-luxury text-text-primary hover:bg-brand-beige"
                  }`}
                >
                  {resolveLocalizedString(value.label, locale)}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-text-primary">{t("quantity")}</span>
        <QuantitySelector value={quantity} max={Math.max(stock, 1)} disabled={soldOut} onChange={setQuantity} />
        {!soldOut && stock <= 5 ? (
          <span className="text-xs text-text-primary/70">{tProduct("lowStock", { count: stock })}</span>
        ) : null}
      </div>

      <FormError message={error ?? wishlistError} />

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" onClick={handleAddToCart} disabled={!canAddToCart || isPending} className="flex-1">
          {soldOut ? t("soldOut") : t("addToCart")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleAddToWishlist}
          disabled={!hasChosenRequiredOption || wishlistPending}
          className="flex items-center gap-2"
        >
          <Heart aria-hidden="true" size={18} />
          {t("addToWishlist")}
        </Button>
      </div>
    </div>
  );
}
