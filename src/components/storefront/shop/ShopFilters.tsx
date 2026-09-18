"use client";

import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, Search } from "lucide-react";
import { useRouter } from "@/lib/i18n/navigation";
import { formatCurrency } from "@/lib/utils/currency";
import { buildShopHref, PRICE_BANDS, type ShopSearchParams } from "./shopQuery";

export type FilterCategory = { slug: string; label: string };

const SECTION_TITLE = "font-body text-[0.8125rem] font-medium text-text-primary";

const CHECK_ROW =
  "group/row flex min-h-8 w-full items-center gap-2.5 text-start text-[0.8125rem] text-text-secondary transition-colors hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-burgundy";

/** The reference's small square checkbox, drawn rather than native. */
function CheckBox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex size-[13px] shrink-0 items-center justify-center border transition-colors ${
        checked ? "border-brand-burgundy bg-brand-burgundy" : "border-hairline-strong bg-brand-ivory"
      }`}
    >
      {checked ? (
        <svg viewBox="0 0 10 8" className="size-2 text-text-on-dark" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M1 4.2 3.5 6.7 9 1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </span>
  );
}

function Section({
  title,
  children,
  last,
}: {
  title: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section className={last ? "" : "border-b border-hairline pb-5"}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-9 w-full items-center justify-between gap-3 text-start focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-burgundy"
      >
        <span className={SECTION_TITLE}>{title}</span>
        <ChevronDown
          aria-hidden="true"
          size={14}
          className={`shrink-0 text-text-secondary transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? <div className="mt-2 flex flex-col">{children}</div> : null}
    </section>
  );
}

/**
 * The Shop filter sidebar — rendered once here for desktop and again inside
 * the mobile drawer, so there is one source of filter state and no
 * duplicated logic.
 *
 * ── ONLY REAL FILTERS ────────────────────────────────────────────────────
 * The approved reference shows five sections: Category, Price, Availability,
 * Offers and Collection. `listProducts` supports only `categoryId`,
 * `minPrice`/`maxPrice` (plus search and sort), so only **Category** and
 * **Price** are rendered.
 *
 * The other three are deliberately absent rather than drawn as inert
 * checkboxes: Availability cannot be filtered (the query always constrains
 * `availability == true`, and Sold Out is derived live from `stock` so that
 * such products stay browsable — spec FR-015a); there is no `isOnSale`
 * filter on the listing query; and the product model has no Collection
 * field at all. Rendering them would promise filtering the catalogue cannot
 * perform.
 *
 * Counts are likewise omitted — the reference's "(8)" figures would each
 * need its own aggregate query, and inventing them is not an option.
 *
 * Every change is written to the URL, so filters stay bookmarkable,
 * server-readable, and shared by the pagination cursor.
 */
export function ShopFilters({
  pathname,
  current,
  categories,
  activeCategorySlug,
  priceDisabled,
  onNavigate,
}: {
  pathname: string;
  current: ShopSearchParams;
  categories: FilterCategory[];
  activeCategorySlug: string;
  priceDisabled: boolean;
  onNavigate?: () => void;
}) {
  const t = useTranslations("Shop");
  const locale = useLocale();
  const router = useRouter();
  const [search, setSearch] = useState(current.q ?? "");

  function go(next: Partial<ShopSearchParams>) {
    router.push(buildShopHref(pathname, current, next));
    onNavigate?.();
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    go({ q: search || undefined });
  }

  const activeBand = PRICE_BANDS.find(
    (band) => String(band.min ?? "") === (current.min ?? "") && String(band.max ?? "") === (current.max ?? ""),
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Search lives here rather than in the toolbar: the reference's
          toolbar carries only Filters / category context / count / sort. */}
      <form onSubmit={submitSearch} className="relative flex items-center">
        <Search aria-hidden="true" size={13} className="pointer-events-none absolute start-3 text-text-secondary" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          className="min-h-9 w-full min-w-0 border border-hairline-strong bg-brand-ivory ps-8 pe-3 text-xs text-text-primary placeholder:text-text-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-burgundy"
        />
      </form>

      <Section title={t("category")}>
        <button
          type="button"
          onClick={() => go({ category: undefined })}
          className={`${CHECK_ROW} ${activeCategorySlug === "" ? "!text-text-primary" : ""}`}
        >
          <CheckBox checked={activeCategorySlug === ""} />
          {t("allProducts")}
        </button>
        {categories.map((category) => {
          const active = category.slug === activeCategorySlug;
          return (
            <button
              key={category.slug}
              type="button"
              onClick={() => go({ category: active ? undefined : category.slug })}
              className={`${CHECK_ROW} ${active ? "!text-text-primary" : ""}`}
            >
              <CheckBox checked={active} />
              {category.label}
            </button>
          );
        })}
      </Section>

      <Section title={t("price")} last>
        {PRICE_BANDS.map((band) => {
          const active = activeBand?.id === band.id;
          return (
            <button
              key={band.id}
              type="button"
              disabled={priceDisabled}
              onClick={() =>
                go(
                  active
                    ? { min: undefined, max: undefined }
                    : { min: band.min ? String(band.min) : undefined, max: band.max ? String(band.max) : undefined },
                )
              }
              className={`${CHECK_ROW} disabled:cursor-not-allowed disabled:opacity-45 ${active ? "!text-text-primary" : ""}`}
            >
              <CheckBox checked={active} />
              {/* The amounts are formatted here, not inside the message:
                  the store's prices are stored in minor units, and ICU has
                  no portable way to scale them inside a placeholder. */}
              {t(band.labelKey as "priceUnder" | "priceBetween" | "priceAbove", {
                min: band.min !== undefined ? formatCurrency(band.min, locale) : "",
                max: band.max !== undefined ? formatCurrency(band.max, locale) : "",
              })}
            </button>
          );
        })}
        {priceDisabled ? (
          // Honest, not decorative: the listing query genuinely drops the
          // price range while a search is active.
          <p className="mt-2 text-[0.6875rem] leading-snug text-text-secondary">{t("priceSearchNote")}</p>
        ) : null}
      </Section>

      <button
        type="button"
        onClick={() => {
          setSearch("");
          router.push(pathname);
          onNavigate?.();
        }}
        className="inline-flex min-h-8 w-fit items-center text-[0.75rem] text-text-secondary underline-offset-4 transition-colors hover:text-text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-burgundy"
      >
        {t("reset")}
      </button>
    </div>
  );
}
