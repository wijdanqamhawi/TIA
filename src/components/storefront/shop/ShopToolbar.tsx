"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createPortal } from "react-dom";
import { SlidersHorizontal, X, ChevronDown } from "lucide-react";
import { useRouter } from "@/lib/i18n/navigation";
import type { ProductSort } from "@/lib/domain/catalog/product.service";
import { ShopFilters, type FilterCategory } from "./ShopFilters";
import { buildShopHref, VALID_SORTS, type ShopSearchParams } from "./shopQuery";

/**
 * The Shop toolbar of the approved design: a Filters control and the active
 * category context on the start side, the real product count and the Sort By
 * select on the end side, between two hairlines.
 *
 * The Filters control opens a drawer carrying the *same* `ShopFilters` panel
 * the desktop sidebar renders — one component, one state source. The drawer
 * is portalled to `document.body` so no ancestor's stacking or clipping
 * context can trap it.
 *
 * Sorting behaviour is unchanged: it still writes `sort` to the URL.
 */
export function ShopToolbar({
  pathname,
  current,
  categories,
  activeCategorySlug,
  activeCategoryLabel,
  priceDisabled,
  sort,
  resultCount,
  hasMore,
}: {
  pathname: string;
  current: ShopSearchParams;
  categories: FilterCategory[];
  activeCategorySlug: string;
  activeCategoryLabel: string | null;
  priceDisabled: boolean;
  sort: ProductSort;
  resultCount: number;
  hasMore: boolean;
}) {
  const t = useTranslations("Shop");
  const tNav = useTranslations("Nav");
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const drawer =
    open && typeof document !== "undefined"
      ? createPortal(
          <div className="fixed inset-0 z-50">
            <button
              type="button"
              aria-label={tNav("closeMenu")}
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-brand-burgundy-dark/45 backdrop-blur-sm"
            />
            <div className="relative ms-auto flex h-full w-[min(88vw,21rem)] flex-col overflow-y-auto border-s border-hairline bg-brand-ivory shadow-elev-3">
              <div className="flex items-center justify-between gap-4 border-b border-hairline px-5 py-4">
                <span className="font-display text-lg text-text-primary">{t("filtersTitle")}</span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label={tNav("closeMenu")}
                  className="-me-2 flex min-h-11 min-w-11 items-center justify-center rounded-full text-text-primary/70 transition-colors hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-burgundy"
                >
                  <X aria-hidden="true" size={18} />
                </button>
              </div>
              <div className="px-5 py-6">
                <ShopFilters
                  pathname={pathname}
                  current={current}
                  categories={categories}
                  activeCategorySlug={activeCategorySlug}
                  priceDisabled={priceDisabled}
                  onNavigate={() => setOpen(false)}
                />
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="flex h-auto flex-col gap-3 border-y border-hairline py-3 sm:h-[4.375rem] sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:py-0">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-9 items-center gap-2 text-[0.8125rem] text-text-primary transition-opacity hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-burgundy"
        >
          <SlidersHorizontal aria-hidden="true" size={15} className="text-text-primary" />
          {t("filters")}
        </button>

        <span aria-hidden="true" className="hidden h-5 w-px bg-hairline-strong sm:block" />

        <p className="text-[0.8125rem] text-text-secondary">{activeCategoryLabel ?? t("allCategories")}</p>
      </div>

      <div className="flex items-center justify-between gap-5 sm:justify-end sm:gap-6">
        <p className="text-[0.8125rem] text-text-secondary">
          {hasMore ? `${resultCount}+` : t("productCount", { count: resultCount })}
        </p>

        <label className="flex items-center gap-2.5 text-[0.8125rem] text-text-secondary">
          {t("sortBy")}
          <span className="relative inline-flex items-center">
            <select
              value={sort}
              onChange={(e) => router.push(buildShopHref(pathname, current, { sort: e.target.value }))}
              className="min-h-9 appearance-none border border-hairline-strong bg-brand-ivory pe-7 ps-3 text-[0.8125rem] text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-burgundy"
            >
              {VALID_SORTS.map((option) => (
                <option key={option} value={option}>
                  {t(`sort${option.charAt(0).toUpperCase()}${option.slice(1)}` as "sortNewest" | "sortPrice" | "sortPopularity")}
                </option>
              ))}
            </select>
            <ChevronDown
              aria-hidden="true"
              size={13}
              className="pointer-events-none absolute end-2 text-text-secondary"
            />
          </span>
        </label>
      </div>

      {drawer}
    </div>
  );
}
