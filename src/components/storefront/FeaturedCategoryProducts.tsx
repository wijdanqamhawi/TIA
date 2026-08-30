import { getTranslations } from "next-intl/server";
import { getFeaturedProductsForCategory } from "@/lib/domain/catalog/categoryShowcase.service";
import { toProductCardData } from "@/lib/domain/catalog/product.service";
import { getWishlistedProductIds } from "@/lib/domain/wishlist/wishlist.service";
import { ProductCard } from "./ProductCard";
import { PRODUCT_GRID_CLASS } from "./productGrid";

/**
 * The homepage "Featured {Category}" strip (spec FR-001b): renders a
 * small `ProductCard` grid from the live, category-scoped query (T051) —
 * never denormalized, never leaking another category's products. Renders
 * nothing if the category currently has no available products, so the
 * homepage degrades gracefully rather than showing an empty section
 * (spec Edge Cases).
 */
export async function FeaturedCategoryProducts({
  categoryId,
  categoryLabel,
  locale,
}: {
  categoryId: string;
  categoryLabel: string;
  locale: string;
}) {
  const [t, rawProducts, wishlistedProductIds] = await Promise.all([
    getTranslations({ locale, namespace: "Home" }),
    getFeaturedProductsForCategory(categoryId, 4),
    getWishlistedProductIds(),
  ]);

  if (rawProducts.length === 0) {
    return null;
  }

  const products = rawProducts.map((product) => toProductCardData(product, wishlistedProductIds));

  return (
    <div className="container-luxury py-8">
      <h3 className="mb-4 text-center font-display text-xl text-text-primary">
        {t("featuredIn", { category: categoryLabel })}
      </h3>
      <div className={PRODUCT_GRID_CLASS}>
        {products.map((product) => (
          <ProductCard key={product.id} product={product} locale={locale} />
        ))}
      </div>
    </div>
  );
}
