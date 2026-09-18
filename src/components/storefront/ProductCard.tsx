"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Heart } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { Badge } from "@/components/ui/Badge";
import { OfferPrice } from "@/components/ui/Price";
import { FormError } from "@/components/ui/FormError";
import { resolveLocalizedString } from "@/types/localizedString";
import type { ProductCardData } from "@/lib/domain/catalog/product.service";
import { isSoldOut } from "@/lib/domain/catalog/soldOut";
import { addCartItemAction } from "@/actions/cart.actions";
import { addWishlistItemAction, removeWishlistItemAction } from "@/actions/wishlist.actions";
import { buildWishlistIntent } from "@/lib/domain/wishlist/wishlist-intent";
import { resolveProductImage } from "@/lib/config/demoImages";
import { getColorVariants } from "@/lib/domain/catalog/colorVariants";
import { ColorSwatches } from "./ColorSwatches";
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

export function ProductCard({
  product,
  locale,
  variant = "grid",
  motion = false,
}: {
  product: ProductCardProduct;
  locale: string;
  /**
   * `editorial` only — opts into the refined hover set used by the
   * homepage Best Sellers row: the image frame lifts 3px and the image
   * scales to 1.02, Add to Cart fades in while rising, the title lifts
   * 1.5px (the price stays put), and the heart scales to 1.06. Pointer
   * devices only, and every movement is reset under reduced motion.
   * Presentation only — no handler or state differs.
   */
  motion?: boolean;
  /**
   * `grid` — the standard catalogue card. `editorial` — the minimal
   * presentation used on the homepage's dark New Arrivals band: image
   * dominant, name/price/heart beneath, Add to Cart revealed over the
   * image. Presentation only: both variants call the same handlers below.
   */
  variant?: "grid" | "editorial";
}) {
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
  const soldOut = isSoldOut(product);
  const hasOptions = product.options.length > 0;

  // ── COLOUR VARIANTS (PREVIEW ONLY) ───────────────────────────────────
  // Derived entirely from the product's existing data: its `color` option
  // values paired with the images already tagged with the matching
  // `valueKey` — the very same source of truth the detail-page gallery
  // switches on. Nothing product-specific is named here, so any product
  // that gains photographed colours gets this automatically, and a product
  // with none gets an empty list and the card it has always had.
  const colorVariants = getColorVariants(product);
  // The first photographed colour is pre-selected, matching the detail
  // page's "Color: Gold" on arrival and the photo this card already showed.
  const [selectedColorKey, setSelectedColorKey] = useState<string | null>(colorVariants[0]?.key ?? null);
  const selectedVariant = colorVariants.find((variant) => variant.key === selectedColorKey) ?? null;
  const primaryImage = selectedVariant?.image ?? product.images[0];
  // The product's own uploaded photo always wins; a deterministic demo
  // image stands in only while a product has none (see demoImages.ts).
  const image = resolveProductImage(primaryImage?.url, product.id);
  const imageAlt = primaryImage?.alt || name;

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

  if (variant === "editorial") {
    // Hover classes differ only when `motion` is set; everything else —
    // markup, handlers, state — is identical between the two. Each class is
    // written out literally (never assembled by interpolation) so Tailwind
    // can find and generate it. Tailwind v4's `group-hover:` already applies
    // only on hover-capable devices; the Add to Cart resting offset is
    // gated explicitly so touch screens keep it fully in place.
    const frameMotion = motion
      ? "transition-transform duration-500 ease-luxury group-hover:-translate-y-[3px] motion-reduce:!translate-y-0"
      : "";
    const imageMotion = motion
      ? "transition-transform duration-[800ms] ease-luxury group-hover:scale-[1.02] motion-reduce:!scale-100"
      : "transition-transform duration-700 ease-luxury group-hover:scale-[1.05]";
    const addToCartMotion = motion
      ? "transition-[opacity,translate] duration-300 ease-luxury [@media(hover:hover)]:translate-y-2.5 [@media(hover:hover)]:group-hover:translate-y-0 focus-visible:translate-y-0 motion-reduce:!translate-y-0"
      : "transition-opacity duration-300 ease-luxury";
    const titleMotion = motion
      ? "transition-[opacity,translate] duration-300 ease-luxury group-hover:-translate-y-[1.5px] motion-reduce:!translate-y-0"
      : "transition-opacity";
    const heartMotion = motion
      ? "transition-[opacity,scale] duration-300 ease-luxury hover:scale-[1.06] active:scale-[1.06] motion-reduce:!scale-100"
      : "transition-opacity";

    return (
      <div className="group relative flex flex-col text-current">
        <div className={`relative aspect-[3/2] w-full overflow-hidden bg-brand-cream ${frameMotion}`}>
          <Link href={`/shop/${product.slug}`} className="block h-full w-full" tabIndex={-1} aria-hidden="true">
            <Image
              src={image.url}
              alt={imageAlt}
              fill
              sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 16vw"
              className={`object-cover object-center ${imageMotion} ${soldOut ? "opacity-55 saturate-[0.7]" : ""}`}
            />
          </Link>

          {/* The wishlist heart sits in the image's end corner, as in the
              reference, rather than beside the title. */}
          <button
            type="button"
            onClick={handleToggleWishlist}
            disabled={wishlistPending}
            aria-label={isWishlisted ? t("removeFromWishlist") : t("addToWishlist")}
            aria-pressed={isWishlisted}
            className={`absolute end-1 top-1 z-10 flex min-h-11 min-w-11 items-center justify-center text-text-primary/75 ${heartMotion} hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-burgundy disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <Heart aria-hidden="true" size={16} strokeWidth={1.5} fill={isWishlisted ? "currentColor" : "none"} />
          </button>

          {soldOut || product.offerStatus === "ACTIVE" ? (
            <div className="absolute start-2 top-2 z-10">
              {soldOut ? <Badge variant="danger">{t("soldOut")}</Badge> : <Badge variant="burgundy">{t("onSale")}</Badge>}
            </div>
          ) : null}

          {/* Add to Cart, revealed over the image on hover/focus with a
              pointer; always present on touch screens, where there is no
              hover to reveal it. Suppressed entirely when the product is
              sold out — the badge already says so, and rendering a second
              full-width "SOLD OUT" bar over the photograph made the card
              read as broken. */}
          {soldOut ? null : (
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={isPending}
              className={`absolute inset-x-2 bottom-2 z-10 flex min-h-11 items-center justify-center bg-brand-ivory/95 px-2 text-[0.5625rem] font-medium uppercase tracking-[0.2em] text-brand-espresso backdrop-blur-sm ${addToCartMotion} focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-on-dark disabled:cursor-not-allowed disabled:opacity-60 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 rtl:text-xs rtl:normal-case rtl:tracking-normal`}
            >
              {t("addToCart")}
            </button>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-0.5 pt-2.5">
          <Link
            href={`/shop/${product.slug}`}
            className={`line-clamp-1 text-xs leading-snug text-current ${titleMotion} hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current`}
          >
            {name}
          </Link>
          <ColorSwatches
            variants={colorVariants}
            selectedKey={selectedColorKey}
            onSelect={setSelectedColorKey}
            locale={locale}
            className="pt-0.5"
            labelClassName="text-current opacity-70"
          />
          <OfferPrice
            price={product.price}
            effectivePrice={product.effectivePrice}
            offerStatus={product.offerStatus}
            locale={locale}
            className="text-xs !font-normal !text-current [&_span]:!font-normal [&_span]:!text-current"
            originalPriceLabel={t("originalPrice")}
            salePriceLabel={t("salePrice")}
          />
        </div>
        <FormError message={error ?? wishlistError} />

        <QuickView product={product} locale={locale} open={quickViewOpen} onClose={() => setQuickViewOpen(false)} />
      </div>
    );
  }

  return (
    <div className="group relative flex flex-col">
      {/* 6:5 pearl frame, badge at the start corner and the wishlist heart at
          the end corner — the catalogue card of the approved Shop design.
          Add to Cart and Quick View are revealed *over* the photograph on
          hover rather than stacked beneath the price, so the card is image /
          name / price at rest. Both stay in the DOM and enabled at all times
          (and fully visible on touch, where there is no hover), which is what
          keeps every existing Add-to-Cart flow working. */}
      <div className="relative aspect-[6/5] w-full overflow-hidden bg-brand-cream">
        <Link href={`/shop/${product.slug}`} className="block h-full w-full" tabIndex={-1} aria-hidden="true">
          <Image
            src={image.url}
            alt={imageAlt}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className={`object-cover object-center transition-transform duration-700 ease-luxury group-hover:scale-[1.04] ${soldOut ? "opacity-55 saturate-[0.7]" : ""}`}
          />
        </Link>

        <div className="absolute start-2.5 top-2.5 z-10 flex flex-col items-start gap-1.5">
          {soldOut ? (
            <Badge variant="danger">{t("soldOut")}</Badge>
          ) : (
            <>
              {product.offerStatus === "ACTIVE" ? <Badge variant="gold">{t("onSale")}</Badge> : null}
              {product.isNewArrival ? <Badge variant="gold">{tHome("newArrivals")}</Badge> : null}
              {product.isBestSeller ? <Badge variant="gold">{tHome("bestSellers")}</Badge> : null}
            </>
          )}
        </div>

        <button
          type="button"
          onClick={handleToggleWishlist}
          disabled={wishlistPending}
          aria-label={isWishlisted ? t("removeFromWishlist") : t("addToWishlist")}
          aria-pressed={isWishlisted}
          className="absolute end-1 top-1 z-10 flex min-h-10 min-w-10 items-center justify-center rounded-full text-text-primary/75 transition-all duration-200 ease-luxury hover:scale-110 hover:text-text-primary active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-burgundy disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Heart aria-hidden="true" size={16} strokeWidth={1.5} fill={isWishlisted ? "currentColor" : "none"} />
        </button>

        <button
          type="button"
          onClick={() => setQuickViewOpen(true)}
          className="absolute inset-x-0 bottom-0 z-10 hidden min-h-10 items-center justify-center bg-brand-ivory/95 text-[0.5625rem] font-medium uppercase tracking-[0.18em] text-text-primary backdrop-blur-sm transition-opacity duration-300 ease-luxury focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-burgundy sm:flex [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100 rtl:text-xs rtl:normal-case rtl:tracking-normal"
        >
          {t("quickView")}
        </button>

        <button
          type="button"
          onClick={handleAddToCart}
          disabled={soldOut || isPending}
          className="absolute inset-x-0 bottom-0 z-20 flex min-h-10 items-center justify-center bg-brand-burgundy px-2 text-[0.5625rem] font-medium uppercase tracking-[0.18em] text-text-on-dark transition-opacity duration-300 ease-luxury focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-burgundy disabled:cursor-not-allowed disabled:bg-brand-burgundy/55 sm:bottom-10 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 rtl:text-xs rtl:normal-case rtl:tracking-normal"
        >
          {soldOut ? t("soldOut") : t("addToCart")}
        </button>
      </div>

      <div className="flex flex-1 flex-col items-start gap-1 pt-3">
        <Link
          href={`/shop/${product.slug}`}
          className="text-[0.8125rem] font-normal leading-snug text-text-primary transition-opacity hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-burgundy"
        >
          {name}
        </Link>
        {/* "3 Colors" + swatches sit between the name and the price, as in
            the approved card composition. The block renders nothing at all
            for a product without photographed colour variants, so no card
            gains an empty control or changes height. */}
        <ColorSwatches
          variants={colorVariants}
          selectedKey={selectedColorKey}
          onSelect={setSelectedColorKey}
          locale={locale}
        />
        <OfferPrice
          price={product.price}
          effectivePrice={product.effectivePrice}
          offerStatus={product.offerStatus}
          locale={locale}
          className="text-[0.8125rem]"
          originalPriceLabel={t("originalPrice")}
          salePriceLabel={t("salePrice")}
        />
        <FormError message={error ?? wishlistError} />
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
