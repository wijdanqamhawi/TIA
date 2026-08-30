"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Heart } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { OfferPrice } from "@/components/ui/Price";
import { FormError } from "@/components/ui/FormError";
import { resolveLocalizedString } from "@/types/localizedString";
import type { ProductCardData } from "@/lib/domain/catalog/product.service";
import { isSoldOut } from "@/lib/domain/catalog/soldOut";
import { addCartItemAction } from "@/actions/cart.actions";
import { addWishlistItemAction, removeWishlistItemAction } from "@/actions/wishlist.actions";
import { buildWishlistIntent } from "@/lib/domain/wishlist/wishlist-intent";
import { QuickView } from "./QuickView";

export type ProductCardProduct = ProductCardData;

/**
 * The reusable product-card (spec: catalog grid, Shop/category pages,
 * homepage Featured strips, quickstart Scenario 1/12): localized image,
 * name, price, New Arrival/Best Seller badges, a wishlist affordance, a
 * Quick View trigger, and Add to Cart. Add to Cart adds directly (via
 * `addCartItemAction`, Phase 6) when the product has no options to
 * choose; when it does, this card opens Quick View instead of guessing a
 * default option, since a card has no room for an option picker.
 * Wishlist similarly needs an option-aware control it has no room for, so
 * for a with-options product the heart button navigates to the full
 * detail page instead of guessing a default option (spec FR-032/FR-033a).
 * A signed-in customer's click adds directly; a guest is redirected to
 * `/login?next=<path>&intent=wishlist:<productId>` (spec FR-033a,
 * research.md §7) — no guest wishlist data is ever stored.
 *
 * Sold Out (spec FR-015a) is derived purely from `stock` — never a
 * separate flag — and the product remains fully visible/browsable here
 * exactly like an in-stock product; only the badge and the disabled Add
 * to Cart control change (spec Edge Cases). Because the homepage's
 * Featured strip and every collection section reuse this exact component,
 * Sold Out state applies there automatically, with no separate
 * homepage-specific logic.
 */
const KNOWN_CART_ISSUES = ["NOT_FOUND", "NOT_AVAILABLE", "SOLD_OUT", "INSUFFICIENT_STOCK", "INVALID_OPTION"] as const;

export function ProductCard({ product, locale }: { product: ProductCardProduct; locale: string }) {
  const t = useTranslations("Common");
  const tHome = useTranslations("Home");
  const tCart = useTranslations("Cart");
  const router = useRouter();
  const pathname = usePathname();
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [wishlistPending, startWishlistTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [wishlistError, setWishlistError] = useState<string | null>(null);
  // Seeded from the server-derived `product.isWishlisted` (product.service.ts's
  // `toProductCardData`) and updated optimistically-on-success below, so the
  // heart reflects the real wishlist state immediately — never a guess — and
  // gives visible confirmation a click actually did something, which a
  // fire-and-forget `router.refresh()` alone did not (root cause of the
  // "heart button doesn't respond" report: the add genuinely succeeded
  // server-side, but nothing on screen ever changed to show it).
  const [isWishlisted, setIsWishlisted] = useState(product.isWishlisted);

  const name = resolveLocalizedString(product.name, locale);
  const image = product.images[0];
  const soldOut = isSoldOut(product);
  const hasOptions = product.options.length > 0;

  function handleToggleWishlist() {
    if (hasOptions) {
      // No option picker fits in a grid card (mirrors Add to Cart's own
      // behavior above) — send the shopper to the full detail page, where
      // `ProductPurchasePanel`'s option-aware wishlist control lives.
      router.push(`/${locale}/shop/${product.slug}`);
      return;
    }

    setWishlistError(null);
    const wasWishlisted = isWishlisted;
    startWishlistTransition(async () => {
      // Toggles between the two existing, already-implemented Server
      // Actions (`addWishlistItemAction`/`removeWishlistItemAction`, Phase
      // 7) — no new wishlist mutation logic here, only which one this
      // button calls and how it reflects the result.
      const result = wasWishlisted
        ? await removeWishlistItemAction({ productId: product.id, selectedOption: null })
        : await addWishlistItemAction({ productId: product.id, selectedOption: null });
      if (!result.ok) {
        if (result.error.code === "UNAUTHENTICATED") {
          const intent = buildWishlistIntent(product.id, null);
          router.push(`/${locale}/login?next=${encodeURIComponent(pathname)}&intent=${encodeURIComponent(intent)}`);
          return;
        }
        setWishlistError(t("error"));
        return;
      }
      setIsWishlisted(!wasWishlisted);
      router.refresh();
    });
  }

  function handleAddToCart() {
    if (hasOptions) {
      setQuickViewOpen(true);
      return;
    }

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
    });
  }

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-lg border border-border-luxury bg-brand-ivory">
      <div className="relative aspect-square w-full overflow-hidden bg-brand-beige">
        <Link href={`/shop/${product.slug}`} className="block h-full w-full" tabIndex={-1} aria-hidden="true">
          {image ? (
            <Image
              src={image.url}
              alt={image.alt || name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className={`object-cover transition-transform duration-300 group-hover:scale-105 ${soldOut ? "opacity-60" : ""}`}
            />
          ) : null}
        </Link>

        <div className="absolute start-2 top-2 flex flex-col gap-1">
          {soldOut ? (
            <Badge variant="danger">{t("soldOut")}</Badge>
          ) : (
            <>
              {product.offerStatus === "ACTIVE" ? <Badge variant="burgundy">{t("onSale")}</Badge> : null}
              {product.isNewArrival ? <Badge variant="gold">{tHome("newArrivals")}</Badge> : null}
              {product.isBestSeller ? <Badge variant="burgundy">{tHome("bestSellers")}</Badge> : null}
            </>
          )}
        </div>

        <button
          type="button"
          onClick={handleToggleWishlist}
          disabled={wishlistPending}
          aria-label={isWishlisted ? t("removeFromWishlist") : t("addToWishlist")}
          aria-pressed={isWishlisted}
          className="absolute end-2 top-2 flex min-h-9 min-w-9 items-center justify-center rounded-full bg-brand-ivory/90 text-brand-burgundy shadow-sm hover:bg-brand-ivory focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-burgundy disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Heart aria-hidden="true" size={18} fill={isWishlisted ? "currentColor" : "none"} />
        </button>

        <button
          type="button"
          onClick={() => setQuickViewOpen(true)}
          className="absolute inset-x-2 bottom-2 hidden min-h-9 items-center justify-center rounded-md bg-brand-ivory/90 text-sm font-medium text-text-primary opacity-0 shadow-sm transition-opacity hover:bg-brand-ivory group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-burgundy sm:flex"
        >
          {t("quickView")}
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <Link href={`/shop/${product.slug}`} className="font-medium text-text-primary hover:text-brand-burgundy">
          {name}
        </Link>
        <OfferPrice
          price={product.price}
          effectivePrice={product.effectivePrice}
          offerStatus={product.offerStatus}
          locale={locale}
          className="text-sm"
          originalPriceLabel={t("originalPrice")}
          salePriceLabel={t("salePrice")}
        />
        <FormError message={error ?? wishlistError} />
        <Button
          type="button"
          size="sm"
          onClick={handleAddToCart}
          disabled={soldOut || isPending}
          className="mt-2 w-full"
        >
          {soldOut ? t("soldOut") : t("addToCart")}
        </Button>
      </div>

      <QuickView
        product={product}
        locale={locale}
        open={quickViewOpen}
        onClose={() => setQuickViewOpen(false)}
      />
    </div>
  );
}
