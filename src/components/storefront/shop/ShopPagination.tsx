"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * The centred minimal pagination of the approved Shop design: a navy filled
 * circle for the current page, plain navy numerals either side, and chevron
 * controls at each end.
 *
 * ── IT DRIVES THE EXISTING CURSOR MODEL, NOT A NEW ONE ───────────────────
 * The catalogue is paginated by Firestore cursor (research.md §17), which is
 * forward-only and has no total count — so there is no honest way to render
 * "1 2 3" for pages that have not been fetched. Instead the numerals reflect
 * the pages actually loaded so far: the next chevron fetches the following
 * page (the same `loadMoreProductsAction` the previous "Load More" button
 * called), and the numerals let the shopper jump back to a page already in
 * hand. Nothing is fabricated, and no page count is invented.
 *
 * Renders nothing at all when there is a single page and no further cursor,
 * which is the common case for a small catalogue.
 */
export function ShopPagination({
  page,
  pageCount,
  hasNext,
  isPending,
  onSelect,
  onNext,
}: {
  /** 1-based index of the page currently shown. */
  page: number;
  /** How many pages have been fetched so far. */
  pageCount: number;
  hasNext: boolean;
  isPending: boolean;
  onSelect: (page: number) => void;
  onNext: () => void;
}) {
  const t = useTranslations("Shop");
  const tCommon = useTranslations("Common");

  if (pageCount <= 1 && !hasNext) return null;

  const CONTROL =
    "flex size-8 items-center justify-center rounded-full text-text-primary transition-colors hover:bg-brand-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-burgundy disabled:cursor-not-allowed disabled:opacity-35";

  return (
    <nav aria-label={t("loadMore")} className="flex items-center justify-center gap-1.5">
      <button
        type="button"
        onClick={() => onSelect(page - 1)}
        disabled={page <= 1}
        aria-label={tCommon("back")}
        className={CONTROL}
      >
        <ChevronLeft aria-hidden="true" size={15} className="rtl:-scale-x-100" />
      </button>

      {Array.from({ length: pageCount }, (_, index) => index + 1).map((n) => {
        const active = n === page;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onSelect(n)}
            aria-current={active ? "page" : undefined}
            className={`flex size-8 items-center justify-center rounded-full text-[0.75rem] tabular-nums transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-burgundy ${
              active
                ? "bg-brand-burgundy font-medium text-text-on-dark"
                : "text-text-primary hover:bg-brand-cream"
            }`}
          >
            {n}
          </button>
        );
      })}

      <button
        type="button"
        onClick={onNext}
        disabled={!hasNext || isPending}
        aria-label={tCommon("continue")}
        className={CONTROL}
      >
        <ChevronRight aria-hidden="true" size={15} className="rtl:-scale-x-100" />
      </button>
    </nav>
  );
}
