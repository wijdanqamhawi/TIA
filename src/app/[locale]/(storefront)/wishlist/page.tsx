import { getTranslations } from "next-intl/server";
import { getWishlistForDisplay, buildWishlistSummary } from "@/lib/domain/wishlist/wishlist.service";
import { WishlistItemCard } from "@/components/storefront/WishlistItemCard";
import { WishlistEmptyState } from "@/components/storefront/WishlistEmptyState";
import { PRODUCT_GRID_CLASS } from "@/components/storefront/productGrid";

// Reads the caller's live wishlist + current product pricing/stock/offer
// state on every request (Constitution Principle 7/9/10) — never
// statically cached. `WishlistLayout` already guards this route.
export const dynamic = "force-dynamic";

/**
 * The `/[locale]/wishlist` page (spec User Story 3): a responsive grid of
 * saved products, each showing current live image/name/price (crossed-out
 * + sale price when an offer is `ACTIVE`) and SOLD OUT state — never a
 * value stored on the wishlist item itself (data-model.md).
 */
export default async function WishlistPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Wishlist" });

  const wishlist = await getWishlistForDisplay();
  const summary = wishlist ? await buildWishlistSummary(wishlist) : { items: [], isEmpty: true };

  return (
    <main className="container-luxury py-10">
      <h1 className="mb-6 text-center font-display text-3xl text-text-primary">{t("title")}</h1>

      {summary.isEmpty ? (
        <WishlistEmptyState locale={locale} />
      ) : (
        <div className={PRODUCT_GRID_CLASS}>
          {summary.items.map((item) => (
            <WishlistItemCard
              key={`${item.productId}:${item.selectedOption?.optionKey ?? ""}:${item.selectedOption?.valueKey ?? ""}`}
              item={item}
              locale={locale}
            />
          ))}
        </div>
      )}
    </main>
  );
}
