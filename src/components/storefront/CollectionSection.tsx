import { ProductCard, type ProductCardProduct } from "./ProductCard";
import { PRODUCT_GRID_CLASS } from "./productGrid";

/**
 * A homepage merchandising row — New Arrivals / Best Sellers / Special
 * Offers (spec FR-001, FR-117) — sourced from live `isNewArrival`/
 * `isBestSeller`/derived-`ACTIVE`-offer-flagged products respectively.
 * Renders nothing when there is no matching data yet (e.g. no product
 * currently has an `ACTIVE` offer), so the homepage degrades gracefully
 * (spec Edge Cases) rather than showing an empty section.
 */
export function CollectionSection({
  title,
  products,
  locale,
}: {
  title: string;
  products: ProductCardProduct[];
  locale: string;
}) {
  if (products.length === 0) {
    return null;
  }

  return (
    <section className="container-luxury py-12 sm:py-16">
      <h2 className="mb-6 text-center font-display text-2xl text-text-primary sm:text-3xl">{title}</h2>
      <div className={PRODUCT_GRID_CLASS}>
        {products.map((product) => (
          <ProductCard key={product.id} product={product} locale={locale} />
        ))}
      </div>
    </section>
  );
}
