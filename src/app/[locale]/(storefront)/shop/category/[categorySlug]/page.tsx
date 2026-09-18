import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { getActiveCategories, getCategoryBySlug } from "@/lib/domain/catalog/category.service";
import { listProducts, toProductCardData, type ProductSort } from "@/lib/domain/catalog/product.service";
import { getWishlistedProductIds } from "@/lib/domain/wishlist/wishlist.service";
import { resolveLocalizedString } from "@/types/localizedString";
import { ShopSearchSort } from "@/components/storefront/ShopSearchSort";
import { ProductGridWithLoadMore } from "@/components/storefront/ProductGridWithLoadMore";
import { cn } from "@/lib/utils/cn";
import { buildLocalizedMetadata } from "@/lib/seo/metadata";
import type { Locale } from "@/lib/i18n/routing";
import { PageHeading } from "@/components/ui/PageHeading";

const VALID_SORTS: ProductSort[] = ["newest", "price", "popularity"];

// Reads live pricing/stock/Sold-Out data on every request (Constitution
// Principle 7/10) — a statically-frozen build would go stale immediately.
export const dynamic = "force-dynamic";

/** T218: bilingual title/description (from the live category name), canonical, and hreflang alternates. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; categorySlug: string }>;
}): Promise<Metadata> {
  const { locale, categorySlug } = await params;
  const category = await getCategoryBySlug(categorySlug);
  if (!category) {
    return {};
  }
  const t = await getTranslations({ locale, namespace: "Seo" });
  const categoryName = resolveLocalizedString(category.name, locale);
  return buildLocalizedMetadata({
    locale: locale as Locale,
    pathname: `/shop/category/${categorySlug}`,
    title: t("categoryTitleTemplate", { category: categoryName }),
    description: t("categoryDescriptionTemplate", { category: categoryName }),
  });
}

/**
 * A dedicated, category-scoped browsing page (spec FR-007a, research.md
 * §1a) — Bracelets, Rings, Earrings, or Watches. `categorySlug` itself
 * stays language-independent; only the rendered category name and product
 * text are localized. Products from other categories never leak in: the
 * listing query filters on this category's `categoryId` only.
 */
export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; categorySlug: string }>;
  searchParams: Promise<{ q?: string; sort?: string }>;
}) {
  const { locale, categorySlug } = await params;
  const sp = await searchParams;

  const category = await getCategoryBySlug(categorySlug);
  if (!category) {
    notFound();
  }

  const search = sp.q?.trim() ?? "";
  const sort: ProductSort = VALID_SORTS.includes(sp.sort as ProductSort) ? (sp.sort as ProductSort) : "newest";

  const [t, categories] = await Promise.all([
    getTranslations({ locale, namespace: "Shop" }),
    getActiveCategories(),
  ]);

  const filters = { categoryId: category.id, search: search || undefined, sort };
  const [{ products, nextCursorId }, wishlistedProductIds] = await Promise.all([
    listProducts({ ...filters, pageSize: 12 }),
    getWishlistedProductIds(),
  ]);

  const categoryName = resolveLocalizedString(category.name, locale);

  return (
    <main className="container-luxury py-14 sm:py-20">
      <PageHeading title={categoryName} className="mb-10 sm:mb-14" />

      <nav className="mb-8 flex gap-2.5 overflow-x-auto pb-2" aria-label={t("title")}>
        <Link
          href="/shop"
          className="shrink-0 rounded-none border border-hairline px-6 py-2.5 text-[0.625rem] font-medium uppercase tracking-[0.18em] text-text-primary/70 transition-colors hover:border-text-primary hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-burgundy rtl:text-xs rtl:normal-case rtl:tracking-normal"
        >
          {t("allProducts")}
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/shop/category/${c.slug}`}
            aria-current={c.id === category.id ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-none border px-6 py-2.5 text-[0.625rem] font-medium uppercase tracking-[0.18em] rtl:text-xs rtl:normal-case rtl:tracking-normal",
              c.id === category.id
                ? "border-brand-burgundy bg-brand-burgundy text-text-on-dark"
                : "border-border-luxury text-text-primary hover:bg-brand-beige",
            )}
          >
            {resolveLocalizedString(c.name, locale)}
          </Link>
        ))}
      </nav>

      <div className="mb-10">
        <ShopSearchSort pathname={`/shop/category/${categorySlug}`} initialSearch={search} initialSort={sort} />
      </div>

      <ProductGridWithLoadMore
        locale={locale}
        initialProducts={products.map((product) => toProductCardData(product, wishlistedProductIds))}
        initialCursorId={nextCursorId}
        filters={filters}
      />
    </main>
  );
}
