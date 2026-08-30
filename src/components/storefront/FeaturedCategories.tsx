import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { resolveLocalizedString } from "@/types/localizedString";
import type { Category } from "@/types/category";

/** The homepage "Shop by Category" quick-entry section (spec FR-001). */
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

  return (
    <section className="container-luxury py-12 sm:py-16">
      <h2 className="mb-6 text-center font-display text-2xl text-text-primary sm:text-3xl">
        {t("featuredCategoriesTitle")}
      </h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/shop/category/${category.slug}`}
            className="flex min-h-24 items-center justify-center rounded-lg border border-border-luxury bg-brand-beige px-4 py-8 text-center font-display text-lg text-brand-burgundy transition-colors hover:bg-brand-gold-muted"
          >
            {resolveLocalizedString(category.name, locale)}
          </Link>
        ))}
      </div>
    </section>
  );
}
