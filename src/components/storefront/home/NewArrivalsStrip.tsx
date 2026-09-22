import type { CSSProperties } from "react";
import { getTranslations } from "next-intl/server";
import { ProductCard, type ProductCardProduct } from "../ProductCard";
import { EditorialRowHeading } from "./EditorialRowHeading";
import { CarouselRow } from "./CarouselRow";

/**
 * "NEW ARRIVALS" — the reference's full-width product row on the warm-white
 * ground: a champagne DISCOVER eyebrow, a serif title with a champagne rule,
 * View All at the end edge, five cards across on desktop, and the two
 * minimal circular carousel arrows sitting just outside the row.
 *
 * Products are the live set the page passes (spec FR-001/FR-117), and each
 * card is the shared `ProductCard` in its `editorial` presentation — so
 * wishlist, Add to Cart, options/Quick View and Sold Out behave exactly as
 * they do everywhere else. The grid is capped at the number of products the
 * store actually has, so a short catalogue never leaves an empty slot.
 */
export async function NewArrivalsStrip({
  products,
  locale,
}: {
  products: ProductCardProduct[];
  locale: string;
}) {
  const [tHome, tCommon] = await Promise.all([
    getTranslations({ locale, namespace: "Home" }),
    getTranslations({ locale, namespace: "Common" }),
  ]);

  if (products.length === 0) return null;
  const columns = Math.min(products.length, 5);

  return (
    // `overflow-x-clip`: the row bleeds to the screen edge with a negative
    // margin on phones. That paints outside the body box and inflates the
    // document's own scroll width even though the body itself clips, so the
    // section clips the paint without becoming a scroll container.
    <section className="overflow-x-clip bg-brand-ivory pb-4 pt-5 text-text-primary">
      <div className="container-rows">
        <EditorialRowHeading
          eyebrow={tHome("discover")}
          title={tHome("newArrivals")}
          actionLabel={tHome("viewAll")}
          actionHref="/shop?collection=new-arrivals"
        />

        <CarouselRow
          previousLabel={tCommon("back")}
          nextLabel={tCommon("continue")}
          style={{ "--na-cols": columns } as CSSProperties}
          className="scrollbar-none -mx-5 flex max-w-[calc(100%+2.5rem)] snap-x snap-mandatory gap-3.5 overflow-x-auto px-5 pb-1 sm:mx-0 sm:grid sm:max-w-full sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-[repeat(var(--na-cols),minmax(0,1fr))]"
        >
          {products.slice(0, 5).map((product) => (
            <li key={product.id} className="w-[44%] shrink-0 snap-start sm:w-auto">
              <ProductCard product={product} locale={locale} variant="editorial" />
            </li>
          ))}
        </CarouselRow>
      </div>
    </section>
  );
}
