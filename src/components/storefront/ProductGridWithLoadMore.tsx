"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/lib/i18n/navigation";
import { loadMoreProductsAction } from "@/actions/catalog.actions";
import type { ListProductsParams } from "@/lib/domain/catalog/product.service";
import type { ProductCardData } from "@/lib/domain/catalog/product.service";
import { ProductCard } from "./ProductCard";
import { PRODUCT_GRID_CLASS } from "./productGrid";
import { ShopPagination } from "./shop/ShopPagination";

/**
 * Renders the initial server-fetched product page, then loads additional
 * pages via Firestore cursor-based pagination (research.md §17) — never
 * loading the full product set at once.
 *
 * The data model is unchanged; only its presentation is. Pages are kept as
 * an array so the approved design's numbered pagination can show the pages
 * already fetched and let the shopper move between them, while the next
 * chevron performs the same cursor fetch the previous "Load More" button
 * did.
 *
 * ── WHY THE FETCHED PAGES ARE RESET ON A FILTER CHANGE ─────────────────
 * Every Shop filter lives in the URL and is applied by the server query, so
 * choosing a category re-renders the page with a correctly filtered
 * `initialProducts`. But a filter click is a *client-side* navigation: React
 * keeps this component mounted at the same position, and `useState`
 * initializers only ever run on the first mount. The already-fetched
 * `pages` therefore survived the navigation and kept being rendered, so the
 * URL and the server response were both right while the grid still showed
 * the previous, unfiltered catalogue — the "category does not filter"
 * report. (An empty result masked it, because the early return below reads
 * the fresh `initialProducts` prop rather than state.)
 *
 * `filtersSignature` is the filter set this cached page list belongs to.
 * When it changes, the cache is discarded during render — the documented
 * React pattern for adjusting state when a prop changes, which re-renders
 * before painting instead of flashing stale products through an effect.
 * Pagination is reset with it, since page 2 of Rings has nothing to do with
 * page 2 of the full catalogue, and so does `cursorId`, which would
 * otherwise page the new filter from the old filter's cursor.
 */
export function ProductGridWithLoadMore({
  locale,
  initialProducts,
  initialCursorId,
  filters,
}: {
  locale: string;
  initialProducts: ProductCardData[];
  initialCursorId: string | null;
  filters: Omit<ListProductsParams, "cursorId">;
}) {
  const t = useTranslations("Shop");
  const router = useRouter();
  const pathname = usePathname();
  const [pages, setPages] = useState<ProductCardData[][]>([initialProducts]);
  const [page, setPage] = useState(1);
  const [cursorId, setCursorId] = useState(initialCursorId);
  const [isPending, startTransition] = useTransition();

  // The filter set these cached pages were fetched for. Serialized rather
  // than compared by identity because the server rebuilds the `filters`
  // object on every render, so its reference always differs even when the
  // filters themselves have not changed (which would reset pagination on an
  // unrelated `router.refresh()`, e.g. after an add-to-cart).
  const filtersSignature = JSON.stringify(filters ?? {});
  const [loadedSignature, setLoadedSignature] = useState(filtersSignature);
  if (filtersSignature !== loadedSignature) {
    setLoadedSignature(filtersSignature);
    setPages([initialProducts]);
    setPage(1);
    setCursorId(initialCursorId);
  }

  function loadNext() {
    // Already fetched — just move to it.
    if (page < pages.length) {
      setPage(page + 1);
      return;
    }
    if (!cursorId) return;
    startTransition(async () => {
      const result = await loadMoreProductsAction({ ...filters, cursorId });
      setPages((prev) => [...prev, result.products]);
      setCursorId(result.nextCursorId);
      setPage((prev) => prev + 1);
    });
  }

  const visible = pages[page - 1] ?? [];

  if (initialProducts.length === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-20 text-center sm:py-24">
        <h2 className="font-display text-[clamp(1.375rem,2vw,1.75rem)] font-normal text-text-primary">
          {t("emptyTitle")}
        </h2>
        <span aria-hidden="true" className="block h-px w-10 bg-brand-gold/60" />
        <p className="text-[0.8125rem] leading-relaxed text-text-secondary">{t("emptyBody")}</p>
        <button
          type="button"
          onClick={() => router.push(pathname)}
          className="mt-1 inline-flex min-h-10 items-center justify-center border border-brand-burgundy px-6 text-[0.625rem] font-medium uppercase tracking-[0.18em] text-brand-burgundy transition-colors duration-300 hover:bg-brand-burgundy hover:text-text-on-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-burgundy rtl:text-xs rtl:normal-case rtl:tracking-normal"
        >
          {t("reset")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <div className={PRODUCT_GRID_CLASS} data-testid="product-grid">
        {visible.map((product) => (
          <ProductCard key={product.id} product={product} locale={locale} />
        ))}
      </div>

      <ShopPagination
        page={page}
        pageCount={pages.length}
        hasNext={page < pages.length || Boolean(cursorId)}
        isPending={isPending}
        onSelect={(next) => {
          if (next >= 1 && next <= pages.length) setPage(next);
        }}
        onNext={loadNext}
      />
    </div>
  );
}
