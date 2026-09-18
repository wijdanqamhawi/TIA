import { RowHeading } from "@/components/ui/PageHeading";
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
  /** Optional "See All" affordance rendered opposite the title. */
  actionLabel,
  actionHref,
  /** Renders the row on the cool-pearl band instead of the page ground, so consecutive rows alternate. */
  tone = "plain",
}: {
  title: string;
  products: ProductCardProduct[];
  locale: string;
  actionLabel?: string;
  actionHref?: string;
  tone?: "plain" | "cream";
}) {
  if (products.length === 0) {
    return null;
  }

  return (
    <section className={tone === "cream" ? "band-cream section-y" : "section-y"}>
      <div className="container-luxury">
        <RowHeading
          title={title}
          actionLabel={actionLabel}
          actionHref={actionHref}
          className="mb-12 sm:mb-16"
        />
        <div className={PRODUCT_GRID_CLASS}>
          {products.map((product) => (
            <ProductCard key={product.id} product={product} locale={locale} />
          ))}
        </div>
      </div>
    </section>
  );
}
