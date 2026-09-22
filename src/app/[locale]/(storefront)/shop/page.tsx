import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getActiveCategories } from "@/lib/domain/catalog/category.service";
import { listProducts, toProductCardData } from "@/lib/domain/catalog/product.service";
import { getWishlistedProductIds } from "@/lib/domain/wishlist/wishlist.service";
import { resolveLocalizedString } from "@/types/localizedString";
import { formatCurrency } from "@/lib/utils/currency";
import { ProductGridWithLoadMore } from "@/components/storefront/ProductGridWithLoadMore";
import { ShopToolbar } from "@/components/storefront/shop/ShopToolbar";
import { ShopFilters } from "@/components/storefront/shop/ShopFilters";
import { ActiveFilterChips, type ActiveChip } from "@/components/storefront/shop/ActiveFilterChips";
import { parseShopQuery, type ShopSearchParams } from "@/components/storefront/shop/shopQuery";
import { buildLocalizedMetadata } from "@/lib/seo/metadata";
import type { Locale } from "@/lib/i18n/routing";

// Reads live pricing/stock/Sold-Out data on every request (Constitution
// Principle 7/10) — a statically-frozen build would go stale immediately.
export const dynamic = "force-dynamic";

/**
 * The approved Shop measure: 1300px of *content* at a 1440 viewport. The
 * gutters are added on top of that, so the sidebar + gap + grid resolve to
 * the reference's 243 / 46 / 1010 rather than being squeezed inside 1300.
 */
const CONTAINER = "mx-auto w-full max-w-[calc(81.25rem+2*1.5rem)] px-5 sm:px-6";

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
 * The Shop page (spec FR-007b), built to the approved reference: a centred
 * editorial intro, a hairline-bounded toolbar, a narrow filter sidebar and a
 * four-column catalogue grid with the design's centred pagination.
 *
 * ── FILTERS ARE ONLY WHAT THE QUERY SUPPORTS ─────────────────────────────
 * `listProducts` accepts `categoryId`, `search`, `minPrice`, `maxPrice`,
 * `sort` and a cursor, so the sidebar offers Category and Price. The
 * reference's Availability, Offers and Collection sections have no backing
 * in the data model and are not rendered as inert controls — see
 * `ShopFilters` for the reasoning.
 *
 * Every filter lives in the URL, so the same object drives the first server
 * render *and* the pagination Server Action; the two can never disagree.
 *
 * ── NEW ARRIVALS IS THIS ROUTE, SCOPED ───────────────────────────────────
 * A Collection is a derived query over a Product flag (data-model.md), not a
 * separate catalogue, so New Arrivals has no route of its own: it is this page
 * under `?collection=new-arrivals`, which adds `isNewArrival == true` to the
 * listing query. The scope is exclusive — see `parseShopQuery`.
 */
export default async function ShopPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<ShopSearchParams>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const { search, sort, categorySlug, minPrice, maxPrice, isNewArrivals, priceDisabled } = parseShopQuery(sp);

  const [t, tHome, categories] = await Promise.all([
    getTranslations({ locale, namespace: "Shop" }),
    // The New Arrivals label is the collection's own name, already translated
    // for the homepage row and the navigation — not a second Shop string.
    getTranslations({ locale, namespace: "Home" }),
    getActiveCategories(),
  ]);

  // The URL carries the language-independent slug; the query needs the id.
  // An unknown slug falls back to "all" rather than 404 — a stale bookmark
  // should still show the catalogue.
  const activeCategory = categorySlug ? categories.find((c) => c.slug === categorySlug) ?? null : null;

  const filters = {
    categoryId: activeCategory?.id,
    search: search || undefined,
    isNewArrival: isNewArrivals || undefined,
    sort,
    minPrice,
    maxPrice,
  };

  const [{ products, nextCursorId }, wishlistedProductIds] = await Promise.all([
    listProducts({ ...filters, pageSize: 12 }),
    getWishlistedProductIds(),
  ]);

  const filterCategories = categories.map((category) => ({
    slug: category.slug,
    label: resolveLocalizedString(category.name, locale),
  }));
  const activeCategoryLabel = activeCategory ? resolveLocalizedString(activeCategory.name, locale) : null;

  const chips: ActiveChip[] = [];
  if (isNewArrivals) chips.push({ key: "collection", label: tHome("newArrivals") });
  if (search) chips.push({ key: "q", label: search });
  if (activeCategoryLabel) chips.push({ key: "category", label: activeCategoryLabel });
  if (minPrice !== undefined) chips.push({ key: "min", label: `${t("minPrice")}: ${formatCurrency(minPrice, locale)}` });
  if (maxPrice !== undefined) chips.push({ key: "max", label: `${t("maxPrice")}: ${formatCurrency(maxPrice, locale)}` });

  return (
    <main className="bg-brand-ivory">
      {/* 2 — centred Shop intro */}
      <header className={`${CONTAINER} flex flex-col items-center gap-2 pb-7 pt-9 text-center sm:pb-8 sm:pt-10`}>
        <p className="font-body text-[0.6875rem] font-medium uppercase tracking-[0.24em] text-brand-gold-ink rtl:text-[0.8125rem] rtl:normal-case rtl:tracking-normal">
          {t("eyebrow")}
        </p>
        <span aria-hidden="true" className="block h-px w-9 bg-brand-gold/60" />
        <h1 className="font-display text-[clamp(1.875rem,3.3vw,2.875rem)] font-normal leading-tight text-text-primary">
          {isNewArrivals ? tHome("newArrivals") : activeCategoryLabel ?? t("allTitle")}
        </h1>
        <p className="max-w-[34rem] text-[0.8125rem] leading-relaxed text-text-secondary">{t("allDescription")}</p>
      </header>

      <div className={CONTAINER}>
        {/* 3 — toolbar */}
        <ShopToolbar
          pathname="/shop"
          current={sp}
          categories={filterCategories}
          activeCategorySlug={activeCategory?.slug ?? ""}
          activeCategoryLabel={isNewArrivals ? tHome("newArrivals") : activeCategoryLabel}
          priceDisabled={priceDisabled}
          sort={sort}
          resultCount={products.length}
          hasMore={Boolean(nextCursorId)}
        />

        {/* 4/5 — sidebar + grid, at the reference's 243 / 46 / 1010 measure */}
        <div className="grid gap-8 pb-16 pt-7 lg:grid-cols-[15.1875rem_minmax(0,1fr)] lg:gap-[2.875rem]">
          <aside className="hidden lg:block">
            <ShopFilters
              pathname="/shop"
              current={sp}
              categories={filterCategories}
              activeCategorySlug={activeCategory?.slug ?? ""}
              priceDisabled={priceDisabled}
            />
          </aside>

          <div className="flex min-w-0 flex-col gap-5">
            <ActiveFilterChips pathname="/shop" current={sp} chips={chips} />
            <ProductGridWithLoadMore
              locale={locale}
              initialProducts={products.map((product) => toProductCardData(product, wishlistedProductIds))}
              initialCursorId={nextCursorId}
              filters={filters}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
