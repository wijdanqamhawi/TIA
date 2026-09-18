import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { buildLocalizedMetadata } from "@/lib/seo/metadata";
import type { Locale } from "@/lib/i18n/routing";
import { getActiveCategories } from "@/lib/domain/catalog/category.service";
import { getActiveCategoryShowcases } from "@/lib/domain/catalog/categoryShowcase.service";
import {
  getBestSellers,
  getNewArrivals,
  listProducts,
  toProductCardData,
} from "@/lib/domain/catalog/product.service";
import { getWishlistedProductIds } from "@/lib/domain/wishlist/wishlist.service";
import type { Product } from "@/types/product";
import { Hero } from "@/components/storefront/Hero";
import { FeaturedCategories } from "@/components/storefront/FeaturedCategories";
import { ServiceBenefits } from "@/components/storefront/home/ServiceBenefits";
import { NewArrivalsStrip } from "@/components/storefront/home/NewArrivalsStrip";
import { LessOrdinary } from "@/components/storefront/home/LessOrdinary";
import { EditorialPair } from "@/components/storefront/home/EditorialPair";
import { InstagramGallery } from "@/components/storefront/home/InstagramGallery";
import { NewsletterStrip } from "@/components/storefront/home/NewsletterStrip";
import { resolveHeroImage } from "@/lib/config/demoImages";

// Reads live pricing/stock/Sold-Out/showcase data on every request — a
// statically-frozen build-time snapshot would let this page silently
// disagree with the Shop/category/product pages (spec Edge Cases,
// Constitution Principle 7/10).
export const dynamic = "force-dynamic";

/** T218: bilingual title/description, canonical, and hreflang alternates. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Seo" });
  return buildLocalizedMetadata({
    locale: locale as Locale,
    pathname: "",
    title: t("homeTitle"),
    description: t("homeDescription"),
  });
}

/**
 * The TIA homepage (spec FR-001, FR-117), built to the approved reference
 * in this exact order:
 *
 *   1. Announcement bar  ┐ both rendered by the layout's `Navbar`
 *   2. Navbar            ┘
 *   3. Hero                       7. Less Ordinary (navy campaign banner)
 *   4. Trust strip                8. Editorial pair
 *   5. New Arrivals               9. @TIA gallery
 *   6. Shop by Category          10. Newsletter strip
 *                                11/12. Footer + navy copyright bar (layout)
 *
 * ── SECTIONS THE REFERENCE DOES NOT INCLUDE ──────────────────────────────
 * Best Sellers, Special Offers, The Collection story, the brand statement
 * band and the admin-managed Category Showcase grid are not part of the
 * approved composition and no longer render here. Their components, data
 * and services are untouched — offers still derive and still badge
 * products everywhere they appear (Shop, category and product pages), and
 * the showcases still drive the hero artwork below. Restoring any of them
 * is a one-line change.
 *
 * All product/category content is read live from Firestore via the Admin
 * SDK. Editorial photography is demo fallback only
 * (`lib/config/demoImages.ts`), and a real uploaded image always wins.
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  const [categories, showcases, newArrivals, bestSellers, wishlistedProductIds, popular] = await Promise.all([
    getActiveCategories(),
    getActiveCategoryShowcases(),
    getNewArrivals(),
    getBestSellers(),
    getWishlistedProductIds(),
    // The same read the Shop page uses for "Popularity" — only a
    // presentation fallback for the New Arrivals row (below).
    listProducts({ sort: "popularity", pageSize: 8 }),
  ]);

  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const toCards = (products: Product[]) => products.map((product) => toProductCardData(product, wishlistedProductIds));

  // Hero artwork: the first active showcase's upload, else the demo hero.
  const heroShowcase = showcases[0] ?? null;
  const heroImage = resolveHeroImage(
    heroShowcase
      ? {
          desktopUrl: heroShowcase.desktopImage.url,
          mobileUrl: heroShowcase.mobileImage?.url ?? heroShowcase.desktopImage.url,
        }
      : null,
  );

  // "The Piece": a real product — a bracelet when the store has one, to
  // match the reference's composition — chosen from the live merchandising
  // sets.
  const candidates = [...bestSellers, ...newArrivals];
  const featureProduct =
    candidates.find((product) => categoryById.get(product.categoryId)?.slug === "bracelets") ?? candidates[0] ?? null;

  // New Arrivals row: the live `isNewArrival` products first; when the store
  // has fewer than the five the reference row shows, it is filled from the
  // popularity-ordered catalogue (then Best Sellers) so the row reads as
  // complete — distinct real products only, never a duplicate, and no data
  // is changed.
  const newArrivalIds = new Set<string>();
  const newArrivalDisplay = [...newArrivals, ...popular.products, ...bestSellers]
    .filter((product) => {
      if (newArrivalIds.has(product.id)) return false;
      newArrivalIds.add(product.id);
      return true;
    })
    .slice(0, 5);

  return (
    // `overflow-x-clip`: several rows bleed to the screen edge with a
    // negative margin on phones. That paints outside the body box and
    // inflates the document's own scroll width even though the body clips,
    // so the page clips the paint here without becoming a scroll container
    // (unlike `overflow-x: hidden`, `clip` leaves sticky positioning and the
    // sections' own scroll rows working).
    <main className="overflow-x-clip">
      {/* 3 */}
      <Hero locale={locale} image={heroImage} />
      {/* 4 */}
      <ServiceBenefits locale={locale} />
      {/* 5 */}
      <NewArrivalsStrip products={toCards(newArrivalDisplay)} locale={locale} />
      {/* 6 */}
      <FeaturedCategories categories={categories} locale={locale} />
      {/* 7 */}
      <LessOrdinary locale={locale} />
      {/* 8 */}
      <EditorialPair product={featureProduct} locale={locale} />
      {/* 9 */}
      <InstagramGallery locale={locale} />
      {/* 10 */}
      <NewsletterStrip locale={locale} />
    </main>
  );
}
