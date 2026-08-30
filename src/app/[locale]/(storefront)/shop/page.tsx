import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { getActiveCategories } from "@/lib/domain/catalog/category.service";
import { listProducts, toProductCardData, type ProductSort } from "@/lib/domain/catalog/product.service";
import { getWishlistedProductIds } from "@/lib/domain/wishlist/wishlist.service";
import { resolveLocalizedString } from "@/types/localizedString";
import { ShopSearchSort } from "@/components/storefront/ShopSearchSort";
import { ProductGridWithLoadMore } from "@/components/storefront/ProductGridWithLoadMore";
import { cn } from "@/lib/utils/cn";
import { buildLocalizedMetadata } from "@/lib/seo/metadata";
import type { Locale } from "@/lib/i18n/routing";

const VALID_SORTS: ProductSort[] = ["newest", "price", "popularity"];

// Reads live pricing/stock/Sold-Out data on every request (Constitution
// Principle 7/10) — a statically-frozen build would go stale immediately.
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
    pathname: "/shop",
    title: t("shopTitle"),
    description: t("shopDescription"),
  });
}

/**
 * The Shop page (spec FR-007b): an "All Products / Bracelets / Rings /
 * Earrings / Watches" category switcher (linking to each category's
 * dedicated page, T071), search, sort, and cursor-paginated results —
 * every category label read live from Firestore, never hardcoded (spec
 * FR-046a).
 */
export default async function ShopPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; sort?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;

  const search = sp.q?.trim() ?? "";
  const sort: ProductSort = VALID_SORTS.includes(sp.sort as ProductSort) ? (sp.sort as ProductSort) : "newest";

  const [t, categories] = await Promise.all([
    getTranslations({ locale, namespace: "Shop" }),
    getActiveCategories(),
  ]);

  const filters = { search: search || undefined, sort };
  const [{ products, nextCursorId }, wishlistedProductIds] = await Promise.all([
    listProducts({ ...filters, pageSize: 12 }),
    getWishlistedProductIds(),
  ]);

  return (
    <main className="container-luxury py-10">
      <h1 className="mb-6 text-center font-display text-3xl text-text-primary">{t("title")}</h1>

      <nav className="mb-6 flex gap-2 overflow-x-auto pb-2" aria-label={t("title")}>
        <Link
          href="/shop"
          aria-current="page"
          className={cn(
            "shrink-0 rounded-full border px-4 py-2 text-sm font-medium",
            "border-brand-burgundy bg-brand-burgundy text-text-on-dark",
          )}
        >
          {t("allProducts")}
        </Link>
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/shop/category/${category.slug}`}
            className="shrink-0 rounded-full border border-border-luxury px-4 py-2 text-sm font-medium text-text-primary hover:bg-brand-beige"
          >
            {resolveLocalizedString(category.name, locale)}
          </Link>
        ))}
      </nav>

      <div className="mb-6">
        <ShopSearchSort pathname="/shop" initialSearch={search} initialSort={sort} />
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
