import type { CSSProperties } from "react";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { Link } from "@/lib/i18n/navigation";
import { getFeaturedProductsForCategory } from "@/lib/domain/catalog/categoryShowcase.service";
import { resolveLocalizedString } from "@/types/localizedString";
import type { Category } from "@/types/category";
import { resolveCollectionImage } from "@/lib/config/demoImages";
import { EditorialRowHeading } from "./home/EditorialRowHeading";

/**
 * "SHOP BY CATEGORY" (spec FR-001) — the reference's full-width row on the
 * warm-white ground: a champagne EXPLORE eyebrow, a serif title with a
 * champagne rule, View All at the end edge, and a run of wide, shallow
 * pearl-ground tiles with a centred label beneath each. No borders, no
 * shadows — the photography carries the row.
 *
 * ── WHERE THE IMAGERY COMES FROM ─────────────────────────────────────────
 * `categories/{categoryId}` has no image field and this pass does not
 * change the schema, so each tile shows the category's own newest product
 * photo (`getFeaturedProductsForCategory`), falling back to a slug-matched
 * demo image only while that category has no real photo.
 *
 * The category list comes from Firestore (spec FR-046a), so the row is
 * exactly as wide as the store's live categories — never padded out.
 */
export async function FeaturedCategories({
  categories,
  locale,
}: {
  categories: Category[];
  locale: string;
}) {
  const t = await getTranslations({ locale, namespace: "Home" });

  if (categories.length === 0) {
    return null;
  }

  const withImages = await Promise.all(
    categories.map(async (category) => {
      const products = await getFeaturedProductsForCategory(category.id, 1);
      const image = resolveCollectionImage(products[0]?.images?.[0]?.url, category.slug);
      return { category, image };
    }),
  );
  const columns = Math.min(withImages.length, 5);

  return (
    <section className="overflow-x-clip bg-brand-ivory pb-2 pt-1 text-text-primary">
      <div className="container-rows">
        <EditorialRowHeading
          eyebrow={t("explore")}
          title={t("featuredCategoriesTitle")}
          actionLabel={t("viewAll")}
          actionHref="/shop"
        />

        <ul
          className="scrollbar-none -mx-5 flex max-w-[calc(100%+2.5rem)] snap-x snap-mandatory gap-3.5 overflow-x-auto px-5 pb-1 sm:mx-0 sm:grid sm:max-w-full sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-[repeat(var(--cat-cols),minmax(0,1fr))]"
          style={{ "--cat-cols": columns } as CSSProperties}
        >
          {withImages.map(({ category, image }) => {
            const name = resolveLocalizedString(category.name, locale);
            return (
              <li key={category.id} className="w-[44%] shrink-0 snap-start sm:w-auto">
                <Link
                  href={`/shop/category/${category.slug}`}
                  className="group flex flex-col items-center gap-2 focus-visible:outline-none"
                >
                  <div className="relative aspect-[11/5] w-full overflow-hidden bg-brand-cream group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-4 group-focus-visible:outline-brand-burgundy">
                    <Image
                      src={image.url}
                      alt=""
                      aria-hidden="true"
                      fill
                      sizes="(max-width: 640px) 44vw, (max-width: 1024px) 30vw, 16vw"
                      className="object-cover object-center transition-transform duration-700 ease-luxury group-hover:scale-105"
                    />
                  </div>
                  <h3 className="text-center font-body text-[0.8125rem] text-text-primary transition-opacity group-hover:opacity-70">
                    {name}
                  </h3>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
