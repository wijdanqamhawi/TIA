"use client";

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { ProductImage } from "@/types/product";
import { resolveProductImage, nextDemoProductImage } from "@/lib/config/demoImages";
import { addWishlistItemAction, removeWishlistItemAction } from "@/actions/wishlist.actions";
import { buildWishlistIntent } from "@/lib/domain/wishlist/wishlist-intent";
import { useSelectedVariant } from "./product/SelectedVariantContext";

/**
 * Product-detail image gallery: a narrow vertical thumbnail rail beside a
 * large primary frame on desktop, thumbnails in a horizontal row beneath it
 * below `lg`. The selected thumbnail carries a champagne border; the frame
 * sits on the cool-pearl surface used across the catalogue.
 *
 * ── THE RAIL IS ALWAYS RENDERED ──────────────────────────────────────────
 * The rail shows one thumbnail per real image and never more — no image is
 * ever invented. But it is rendered even for a single-image product, because
 * dropping it would pull the main frame to the container edge and collapse
 * the approved composition: the frame's position and width depend on the
 * rail occupying its track. A one-image product therefore shows a rail of
 * one, which is an honest reflection of what the product has.
 *
 * Each image passes through `resolveProductImage`, so a seeded brand
 * placeholder shows the product's demo photograph instead — a real uploaded
 * photo is always displayed as-is.
 *
 * ── THE WISHLIST HEART ───────────────────────────────────────────────────
 * The heart reflects `isWishlisted`, derived server-side from the shopper's
 * real wishlist and passed in — the same source every product card uses. It
 * toggles through the existing add/remove actions and mirrors the card's
 * guest behaviour exactly. No second wishlist state is created here, and
 * `aria-pressed` always reflects real membership.
 */
export function ImageGallery({
  images,
  name,
  productId,
  isWishlisted: initialWishlisted = false,
  locale,
}: {
  images: ProductImage[];
  name: string;
  /** Used only to pick a stable demo image when a stored image is a placeholder. */
  productId: string;
  isWishlisted?: boolean;
  locale: string;
}) {
  const t = useTranslations("Common");
  const router = useRouter();
  const pathname = usePathname();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isWishlisted, setIsWishlisted] = useState(initialWishlisted);
  const [pending, startTransition] = useTransition();
  const { selectedValueKey } = useSelectedVariant();

  // ── PER-VARIANT PHOTOGRAPHY ────────────────────────────────────────────
  // When a product's images carry a `valueKey`, only the ones belonging to
  // the selected option value are shown, so picking a colour swaps both the
  // main plate and the thumbnail rail to that colour's real photographs.
  //
  // A product whose images carry no `valueKey` is completely unaffected:
  // `hasVariantImages` is false and every image is shown, exactly as
  // before. The same is true if a selected value happens to have no images
  // of its own — the gallery falls back to the full set rather than
  // rendering an empty rail.
  const hasVariantImages = images.some((image) => Boolean(image.valueKey));
  const variantImages =
    hasVariantImages && selectedValueKey ? images.filter((image) => image.valueKey === selectedValueKey) : [];
  const sourceImages = variantImages.length > 0 ? variantImages : images;

  // Switching colour changes the whole image set, so the selected thumbnail
  // returns to the first of the new set. Quantity lives in the purchase
  // panel and is deliberately untouched by a colour change.
  useEffect(() => {
    setActiveIndex(0);
  }, [selectedValueKey]);

  // A seeded product stores the brand placeholder for every image, so every
  // thumbnail would otherwise resolve to the *same* demo photograph.
  //
  // Position 0 resolves from the bare product id, which keeps it identical
  // to the photo this product shows on its card everywhere else. Later
  // positions step forward through the demo pool from that anchor, so a
  // multi-image product gets a genuinely distinct frame per thumbnail —
  // varying the hash key instead was tried and collided (two of three
  // thumbnails landed on the same photo), because hashing into a fixed pool
  // cannot guarantee distinctness.
  //
  // A real uploaded photo is never affected: `resolveProductImage` returns
  // it as-is and the stepping below is skipped entirely.
  const firstResolved = resolveProductImage(sourceImages[0]?.url, productId);
  const resolved = sourceImages.map((image, index) => {
    const own = resolveProductImage(image.url, productId);
    if (!own.isDemo || index === 0) return { ...image, url: own.url };
    return { ...image, url: nextDemoProductImage(firstResolved.url, index) };
  });
  // No stored images at all: still show the product's demo frame.
  const gallery =
    resolved.length > 0
      ? resolved
      : [{ url: resolveProductImage(null, productId).url, alt: name, storagePath: "", position: 0 }];
  const active = gallery[activeIndex] ?? gallery[0];

  function toggleWishlist() {
    const wasWishlisted = isWishlisted;
    startTransition(async () => {
      const result = wasWishlisted
        ? await removeWishlistItemAction({ productId, selectedOption: null })
        : await addWishlistItemAction({ productId, selectedOption: null });
      if (!result.ok) {
        if (result.error.code === "UNAUTHENTICATED") {
          const intent = buildWishlistIntent(productId, null);
          router.push(`/${locale}/login?next=${encodeURIComponent(pathname)}&intent=${encodeURIComponent(intent)}`);
        }
        return;
      }
      setIsWishlisted(!wasWishlisted);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-3.5">
      {/* The rail only stretches to the plate's height when it has enough
          thumbnails to fill it. A product with one or two images kept its
          natural square thumbnails instead: stretching a lone thumbnail to
          a third of the plate's height left it floating in a mostly-empty
          479px column, which looked worse than a short rail ever did. */}
      <div
        className={cn(
          "order-2 flex gap-3 overflow-x-auto lg:order-none lg:w-[6.625rem] lg:shrink-0 lg:flex-col lg:overflow-visible",
          gallery.length >= 3 ? "lg:h-[29.9375rem]" : "lg:h-auto",
        )}
      >
        {gallery.map((image, index) => (
          <button
            key={image.storagePath || image.url + index}
            type="button"
            onClick={() => setActiveIndex(index)}
            aria-label={`${name} ${index + 1}`}
            aria-current={index === activeIndex}
            className={cn(
              // Every thumbnail keeps a visible hairline frame so the rail
              // reads as a contained column beside the image rather than a
              // set of detached floating crops.
              "relative aspect-square w-[4.5rem] shrink-0 overflow-hidden border bg-brand-cream transition-colors duration-300",
              "lg:w-full",
              // Equal shares of the full-height rail only when it is stretched.
              gallery.length >= 3 ? "lg:aspect-auto lg:max-h-[9.5rem] lg:flex-1" : "lg:aspect-square",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-burgundy",
              index === activeIndex ? "border-brand-gold" : "border-hairline hover:border-hairline-strong",
            )}
          >
            <Image src={image.url} alt="" fill sizes="106px" className="object-cover" />
          </button>
        ))}
      </div>

      {/* The reference's frame is a near-square 490×479 plate at 1440 on the
          cool-pearl ground.

          ── WHY object-contain, NOT object-cover ──────────────────────────
          `cover` scaled a portrait 576×720 photograph up to fill a short
          489×396 box, which cropped hard into the middle of the piece and
          made the jewellery read as enormous. `contain` shows the whole
          photograph inside the plate, so the product is fully visible,
          centred, and surrounded by the pearl ground — the padding adds the
          reference's generous negative space instead of zooming to fill.
          Padding is set on the image itself rather than the frame because a
          `fill` image is positioned against the frame's padding box. */}
      {/* Below `lg` the plate is capped by height, not just by ratio. A
          full-width plate at 810 became a ~745px-tall image that filled the
          whole first screen and pushed the title, price and Add to Cart
          below the fold; the cap keeps the product information reachable
          without the shopper scrolling past a single photograph. */}
      <div className="relative order-1 mx-auto aspect-[490/479] max-h-[24rem] w-full overflow-hidden bg-brand-cream lg:order-none lg:max-h-none lg:w-[30.625rem] lg:shrink-0">
        <Image
          src={active.url}
          alt={active.alt || name}
          fill
          sizes="(max-width: 1024px) 100vw, 490px"
          priority
          className="object-contain p-5 lg:p-8"
        />

        <button
          type="button"
          onClick={toggleWishlist}
          disabled={pending}
          aria-label={isWishlisted ? t("removeFromWishlist") : t("addToWishlist")}
          aria-pressed={isWishlisted}
          className="absolute end-3 top-3 z-10 flex min-h-10 min-w-10 items-center justify-center rounded-full text-text-primary/75 transition-all duration-200 ease-luxury hover:scale-110 hover:text-text-primary active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-burgundy disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Heart aria-hidden="true" size={18} strokeWidth={1.5} fill={isWishlisted ? "currentColor" : "none"} />
        </button>
      </div>
    </div>
  );
}
