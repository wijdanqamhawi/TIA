import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { getSpecialOffers, toProductCardData } from "@/lib/domain/catalog/product.service";
import { getWishlistedProductIds } from "@/lib/domain/wishlist/wishlist.service";
import { ProductCard } from "@/components/storefront/ProductCard";
import { PRODUCT_GRID_CLASS } from "@/components/storefront/productGrid";
import { PageHeading } from "@/components/ui/PageHeading";
import { buildLocalizedMetadata } from "@/lib/seo/metadata";
import type { Locale } from "@/lib/i18n/routing";

// Offer status is derived from the current time on every request (an offer becomes Active, expires or
// is stopped by an admin) — a statically-frozen page would go stale immediately.
export const dynamic = "force-dynamic";

/** Generous upper bound for one page of offers; `getSpecialOffers` over-fetches candidates itself. */
const OFFERS_PAGE_LIMIT = 48;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Seo" });
  return buildLocalizedMetadata({
    locale: locale as Locale,
    pathname: "/offers",
    title: t("offersTitle"),
    description: t("offersDescription"),
  });
}

/**
 * Special Offers (spec FR-117/FR-118): every product whose offer is ACTIVE
 * right now — the same `getSpecialOffers` the homepage section reads, so the
 * two can never disagree. Scheduled, Expired and Disabled offers never
 * appear. Each card is the shared `ProductCard`, so the crossed-out regular
 * price, sale price, Sale badge, wishlist, Quick View and Add to Cart behave
 * as everywhere else. With no active offer the page shows a calm empty state.
 */
export default async function OffersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const [t, offers, wishlistedProductIds] = await Promise.all([
    getTranslations({ locale, namespace: "Offers" }),
    getSpecialOffers(OFFERS_PAGE_LIMIT),
    getWishlistedProductIds(),
  ]);
  const products = offers.map((product) => toProductCardData(product, wishlistedProductIds));

  return (
    <main className="container-luxury py-14 sm:py-20">
      <PageHeading title={t("title")} description={t("subtitle")} className="mb-10 sm:mb-14" />

      {products.length === 0 ? (
        <div
          data-testid="offers-empty"
          className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-20 text-center sm:py-24"
        >
          <h2 className="font-display text-[clamp(1.375rem,2vw,1.75rem)] font-normal text-text-primary">
            {t("emptyTitle")}
          </h2>
          <span aria-hidden="true" className="block h-px w-10 bg-brand-gold/60" />
          <p className="text-[0.8125rem] leading-relaxed text-text-secondary">{t("emptyBody")}</p>
          <Link
            href="/shop"
            className="mt-1 inline-flex min-h-10 items-center justify-center border border-brand-burgundy px-6 text-[0.625rem] font-medium uppercase tracking-[0.18em] text-brand-burgundy transition-colors duration-300 hover:bg-brand-burgundy hover:text-text-on-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-burgundy rtl:text-xs rtl:normal-case rtl:tracking-normal"
          >
            {t("shopCta")}
          </Link>
        </div>
      ) : (
        <div className={PRODUCT_GRID_CLASS} data-testid="product-grid">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} locale={locale} />
          ))}
        </div>
      )}
    </main>
  );
}
