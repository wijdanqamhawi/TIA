"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { useRouter } from "@/lib/i18n/navigation";
import { Input } from "@/components/ui/Input";
import type { ProductSort } from "@/lib/domain/catalog/product.service";

const SORTS: ProductSort[] = ["newest", "price", "popularity"];

/**
 * Search + sort controls shared by the Shop page and category pages
 * (spec FR-007b/FR-009). Reflects state in the URL query string so
 * filters are bookmarkable and server-readable — never client-only state
 * hiding what's actually being queried.
 */
export function ShopSearchSort({
  pathname,
  initialSearch,
  initialSort,
}: {
  pathname: string;
  initialSearch: string;
  initialSort: ProductSort;
}) {
  const t = useTranslations("Shop");
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);

  function updateParams(next: { search?: string; sort?: ProductSort }) {
    const params = new URLSearchParams();
    const nextSearch = next.search ?? search;
    const nextSort = next.sort ?? initialSort;

    if (nextSearch) params.set("q", nextSearch);
    if (nextSort !== "newest") params.set("sort", nextSort);

    const query = params.toString();
    router.push(`${pathname}${query ? `?${query}` : ""}`);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateParams({ search });
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm items-center gap-2">
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
        />
        <button
          type="submit"
          aria-label={t("searchPlaceholder")}
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md border border-border-luxury text-text-primary hover:bg-brand-beige focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-burgundy"
        >
          <Search aria-hidden="true" size={18} />
        </button>
      </form>

      <label className="flex items-center gap-2 text-sm text-text-primary">
        {t("sortBy")}
        <select
          value={initialSort}
          onChange={(e) => updateParams({ sort: e.target.value as ProductSort })}
          className="min-h-11 rounded-md border border-border-luxury bg-brand-ivory px-2 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-burgundy"
        >
          {SORTS.map((sort) => (
            <option key={sort} value={sort}>
              {t(`sort${sort.charAt(0).toUpperCase()}${sort.slice(1)}` as "sortNewest" | "sortPrice" | "sortPopularity")}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
