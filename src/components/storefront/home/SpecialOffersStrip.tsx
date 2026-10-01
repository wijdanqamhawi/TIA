import { getTranslations } from "next-intl/server";
import { ProductCard, type ProductCardProduct } from "../ProductCard";
import { EditorialRowHeading } from "./EditorialRowHeading";

/**
 * "SPECIAL OFFERS" — the homepage row for products whose offer is ACTIVE
 * right now, built like "Shop by Category" and "New Arrivals": the same
 * `EditorialRowHeading` (champagne eyebrow, serif title with its rule, View All
 * at the end edge), the same container and the same fixed five-column row —
 * so it is never taller or more prominent than them.
 *
 * It renders only what the page hands it — the products `getSpecialOffers`
 * returns, the same function the standalone offers page uses — and it
 * renders NOTHING when that list is empty, so the homepage never shows an
 * empty Special Offers section. Each card is the shared `ProductCard` in its
 * `editorial` presentation, so the crossed-out regular price, sale price,
 * Sale badge, wishlist, Quick View and Add to Cart behave exactly as they do
 * everywhere else. The status is derived on every request, so a product
 * appears when its offer becomes Active and leaves when it expires or an
 * admin stops it.
 */
export async function SpecialOffersStrip({
  products,
  locale,
}: {
  products: ProductCardProduct[];
  locale: string;
}) {
  if (products.length === 0) return null;

  const tHome = await getTranslations({ locale, namespace: "Home" });

  return (
    <section
      aria-labelledby="home-special-offers"
      className="overflow-x-clip bg-brand-ivory pb-4 pt-3 text-text-primary"
    >
      <div className="container-rows">
        <EditorialRowHeading
          eyebrow={tHome("specialOffersEyebrow")}
          titleId="home-special-offers"
          title={tHome("specialOffers")}
          actionLabel={tHome("viewAll")}
          actionHref="/offers"
        />

        {/* The same row shell as Shop by Category: a plain list that scrolls on phones and sits in a
            fixed five-column grid from `lg`. The columns are FIXED (not sized to the product count),
            so one or two offers stay card-sized and start-aligned instead of stretching across the
            row — the section can never be taller than New Arrivals. */}
        <ul className="scrollbar-none -mx-5 flex max-w-[calc(100%+2.5rem)] snap-x snap-mandatory gap-3.5 overflow-x-auto px-5 pb-1 sm:mx-0 sm:grid sm:max-w-full sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-5">
          {products.slice(0, 5).map((product) => (
            <li key={product.id} className="w-[44%] shrink-0 snap-start sm:w-auto">
              <ProductCard product={product} locale={locale} variant="editorial" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
