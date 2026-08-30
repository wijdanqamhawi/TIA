import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { resolveLocalizedString } from "@/types/localizedString";
import { buildLocalizedMetadata } from "@/lib/seo/metadata";
import type { Locale } from "@/lib/i18n/routing";
import { getActiveCategories } from "@/lib/domain/catalog/category.service";
import { getActiveCategoryShowcases } from "@/lib/domain/catalog/categoryShowcase.service";
import {
  getBestSellers,
  getNewArrivals,
  getSpecialOffers,
  toProductCardData,
} from "@/lib/domain/catalog/product.service";
import { getWishlistedProductIds } from "@/lib/domain/wishlist/wishlist.service";
import { Hero } from "@/components/storefront/Hero";
import { CategoryShowcase } from "@/components/storefront/CategoryShowcase";
import { FeaturedCategoryProducts } from "@/components/storefront/FeaturedCategoryProducts";
import { FeaturedCategories } from "@/components/storefront/FeaturedCategories";
import { CollectionSection } from "@/components/storefront/CollectionSection";
import { BrandIntro } from "@/components/storefront/BrandIntro";

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
 * The ELORA JEWELLERY homepage (spec FR-001, FR-117): Hero → four ×
 * (CategoryShowcase + Featured strip, one per core category in a fixed
 * order) → Featured Categories → New Arrivals/Best Sellers/Special
 * Offers → brand section. All content is read live from Firestore via the
 * Admin SDK — nothing here is hardcoded (spec FR-001a–FR-001c, FR-117).
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  const [tHome, categories, showcases, newArrivals, bestSellers, specialOffers, wishlistedProductIds] =
    await Promise.all([
      getTranslations({ locale, namespace: "Home" }),
      getActiveCategories(),
      getActiveCategoryShowcases(),
      getNewArrivals(),
      getBestSellers(),
      getSpecialOffers(),
      getWishlistedProductIds(),
    ]);

  const categoryById = new Map(categories.map((category) => [category.id, category]));

  return (
    <main>
      <Hero locale={locale} />

      {showcases.map((showcase) => {
        const category = categoryById.get(showcase.categoryId) ?? null;
        const categoryLabel = resolveLocalizedString(category?.name ?? showcase.title, locale);

        return (
          <section key={showcase.id}>
            <CategoryShowcase showcase={showcase} category={category} locale={locale} />
            <FeaturedCategoryProducts
              categoryId={showcase.categoryId}
              categoryLabel={categoryLabel}
              locale={locale}
            />
          </section>
        );
      })}

      <FeaturedCategories categories={categories} locale={locale} />
      <CollectionSection
        title={tHome("newArrivals")}
        products={newArrivals.map((product) => toProductCardData(product, wishlistedProductIds))}
        locale={locale}
      />
      <CollectionSection
        title={tHome("bestSellers")}
        products={bestSellers.map((product) => toProductCardData(product, wishlistedProductIds))}
        locale={locale}
      />
      <CollectionSection
        title={tHome("specialOffers")}
        products={specialOffers.map((product) => toProductCardData(product, wishlistedProductIds))}
        locale={locale}
      />
      <BrandIntro locale={locale} />
    </main>
  );
}
