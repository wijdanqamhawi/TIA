"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  ChevronDown,
  Ellipsis,
  Pencil,
  RotateCcw,
  Search,
  SquareArrowOutUpRight,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/currency";
import { DirectionalIcon } from "@/components/ui/DirectionalIcon";
import {
  setProductFlagAction,
  updateProductAction,
  deleteProductAction,
} from "@/actions/admin/product.actions";
import type { OfferStatus } from "@/lib/domain/catalog/offer";
import {
  filterAdminProducts,
  type AdminProductStatusFilter,
  type AdminProductStockFilter,
} from "@/lib/domain/admin/product-filters";

export type AdminProductRow = {
  id: string;
  /** The product name in the admin language (Arabic falls back to English). */
  name: string;
  nameEn: string;
  nameAr: string | null;
  slug: string;
  imageUrl: string | null;
  categoryId: string;
  categoryName: string;
  price: number;
  salePrice: number | null;
  stock: number;
  isSoldOut: boolean;
  availability: boolean;
  isNewArrival: boolean;
  isBestSeller: boolean;
  offerStatus: OfferStatus;
};

export type AdminProductCategoryOption = { id: string; name: string };

type StockFilter = AdminProductStockFilter;
type StatusFilter = AdminProductStatusFilter;

const PILL =
  "inline-flex h-[26px] items-center justify-center rounded-md px-2.5 text-[12.5px] leading-none whitespace-nowrap";
const PILL_TONE = {
  green: "bg-[#e6f0e9] text-[#2f6844]",
  gold: "bg-brand-gold/[0.16] text-brand-gold-ink",
  gray: "bg-brand-cream text-text-secondary",
  red: "bg-[#f7e8e6] text-[#963a33]",
} as const;
const TOGGLE =
  "transition-[filter,opacity] duration-150 hover:brightness-95 disabled:cursor-wait disabled:opacity-50";

const CONTROL =
  "h-11 w-full rounded-lg border border-brand-burgundy/[0.1] bg-white text-[13.5px] text-brand-burgundy transition-colors focus-visible:border-brand-gold/70 focus-visible:outline-none lg:h-[38px]";

/**
 * T150 — the admin product list: filter bar, compact desktop table (xl+)
 * and a card list below it. Filtering runs client-side over the products
 * the page already loaded. The Visible / New Arrival / Best Seller pills are
 * the existing toggles (same actions as before), and Delete keeps its
 * confirmation, now inside each row's actions menu.
 */
export function AdminProductsTable({
  products,
  categories,
  initialQuery = "",
}: {
  products: AdminProductRow[];
  categories: AdminProductCategoryOption[];
  initialQuery?: string;
}) {
  const t = useTranslations("AdminProducts");
  const locale = useLocale();
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  // A deleted product whose image files could not all be removed from Storage: said plainly, never glossed over.
  const [notice, setNotice] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [categoryId, setCategoryId] = useState("all");
  const [stock, setStock] = useState<StockFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");

  const filtered = useMemo(
    () => filterAdminProducts(products, { query, categoryId, stock, status }),
    [products, query, categoryId, stock, status],
  );

  const hasFilters =
    query.trim() !== "" || categoryId !== "all" || stock !== "all" || status !== "all";
  const currencyLocale = locale === "ar" ? "ar" : "en-US";

  function clearFilters() {
    setQuery("");
    setCategoryId("all");
    setStock("all");
    setStatus("all");
  }

  async function toggleFlag(
    productId: string,
    flag: "isNewArrival" | "isBestSeller",
    value: boolean,
  ) {
    setPendingId(productId);
    await setProductFlagAction({ productId, flag, value: !value });
    setPendingId(null);
    router.refresh();
  }

  // The storefront-visibility toggle is a distinct field from
  // `isNewArrival`/`isBestSeller` (remediation finding F2) — it goes
  // through `updateProductAction` (T144), never `setProductFlagAction`
  // (T146), so it can never be confused with the derived Sold Out state.
  async function toggleAvailability(productId: string, value: boolean) {
    setPendingId(productId);
    await updateProductAction({ productId, availability: !value });
    setPendingId(null);
    router.refresh();
  }

  async function handleDelete(productId: string, name: string) {
    setOpenMenuId(null);
    if (!window.confirm(t("confirmDelete", { name }))) return;
    setPendingId(productId);
    setNotice(null);
    const result = await deleteProductAction({ productId });
    setPendingId(null);
    if (result.ok && result.data.imagesFailed > 0) {
      setNotice(t("imagesFailedNotice", { failed: result.data.imagesFailed }));
    }
    router.refresh();
  }

  function offerPill(row: AdminProductRow) {
    if (row.offerStatus === "DISABLED") {
      return <span className="text-[13px] text-text-secondary/80">{t("offer.DISABLED")}</span>;
    }
    if (row.offerStatus === "ACTIVE") {
      const percent =
        row.salePrice != null && row.price > 0
          ? Math.round(((row.price - row.salePrice) / row.price) * 100)
          : null;
      return (
        <span className={cn(PILL, PILL_TONE.red, "gap-1")}>
          {t("offer.ACTIVE")}
          {percent ? (
            <span dir="ltr" className="lining-nums tabular-nums">
              −{percent}%
            </span>
          ) : null}
        </span>
      );
    }
    return (
      <span className={cn(PILL, row.offerStatus === "SCHEDULED" ? PILL_TONE.gold : PILL_TONE.gray)}>
        {t(`offer.${row.offerStatus}`)}
      </span>
    );
  }

  function stockValue(row: AdminProductRow) {
    return row.isSoldOut ? (
      <span className="inline-flex items-center gap-1.5 text-[13.5px] text-[#963a33]">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-[#c0574d]" />
        <span className="lining-nums tabular-nums">{row.stock}</span>
        <span className="text-[12px]">· {t("soldOut")}</span>
      </span>
    ) : (
      <span className="text-[13.5px] lining-nums tabular-nums text-brand-burgundy">
        {row.stock}
      </span>
    );
  }

  function togglePills(row: AdminProductRow) {
    const busy = pendingId === row.id;
    return {
      visible: (
        <button
          type="button"
          disabled={busy}
          aria-pressed={row.availability}
          title={t("toggleVisible", { name: row.name })}
          onClick={() => toggleAvailability(row.id, row.availability)}
          className={cn(PILL, TOGGLE, row.availability ? PILL_TONE.green : PILL_TONE.gray)}
        >
          {row.availability ? t("visible") : t("hidden")}
        </button>
      ),
      newArrival: (
        <button
          type="button"
          disabled={busy}
          aria-pressed={row.isNewArrival}
          title={t("toggleNewArrival", { name: row.name })}
          onClick={() => toggleFlag(row.id, "isNewArrival", row.isNewArrival)}
          className={cn(
            PILL,
            TOGGLE,
            "min-w-10",
            row.isNewArrival ? PILL_TONE.gold : PILL_TONE.gray,
          )}
        >
          {row.isNewArrival ? t("yes") : t("no")}
        </button>
      ),
      bestSeller: (
        <button
          type="button"
          disabled={busy}
          aria-pressed={row.isBestSeller}
          title={t("toggleBestSeller", { name: row.name })}
          onClick={() => toggleFlag(row.id, "isBestSeller", row.isBestSeller)}
          className={cn(
            PILL,
            TOGGLE,
            "min-w-10",
            row.isBestSeller ? PILL_TONE.gold : PILL_TONE.gray,
          )}
        >
          {row.isBestSeller ? t("yes") : t("no")}
        </button>
      ),
    };
  }

  function actions(row: AdminProductRow) {
    return (
      <div className="flex items-center justify-end gap-1.5">
        <Link
          href={`/admin/products/${row.id}/edit`}
          aria-label={t("editProduct", { name: row.name })}
          className="grid size-9 place-items-center rounded-lg border border-brand-burgundy/[0.1] bg-white text-brand-burgundy transition-colors hover:border-brand-gold/50 hover:bg-brand-ivory lg:size-8"
        >
          <Pencil aria-hidden="true" className="size-[15px] stroke-[1.7]" />
        </Link>
        <RowMenu
          open={openMenuId === row.id}
          onOpenChange={(open) => setOpenMenuId(open ? row.id : null)}
          label={t("moreActions", { name: row.name })}
        >
          <Link
            href={`/admin/products/${row.id}/edit`}
            className="flex min-h-10 items-center gap-2.5 rounded-md px-3 text-[13.5px] text-brand-burgundy hover:bg-brand-cream"
          >
            <Pencil aria-hidden="true" className="size-4 stroke-[1.6] text-text-secondary" />
            {t("edit")}
          </Link>
          <a
            href={`/${locale === "ar" ? "ar" : "en"}/shop/${row.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-10 items-center gap-2.5 rounded-md px-3 text-[13.5px] text-brand-burgundy hover:bg-brand-cream"
          >
            <DirectionalIcon
              icon={SquareArrowOutUpRight}
              aria-hidden="true"
              className="size-4 stroke-[1.6] text-text-secondary"
            />
            {t("viewInStore")}
          </a>
          <div aria-hidden="true" className="my-1 h-px bg-brand-burgundy/[0.07]" />
          <button
            type="button"
            disabled={pendingId === row.id}
            onClick={() => handleDelete(row.id, row.name)}
            className="flex min-h-10 w-full items-center gap-2.5 rounded-md px-3 text-start text-[13.5px] text-[#963a33] hover:bg-[#f7e8e6] disabled:opacity-50"
          >
            <Trash2 aria-hidden="true" className="size-4 stroke-[1.6]" />
            {t("delete")}
          </button>
        </RowMenu>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      {notice ? (
        <p
          role="status"
          data-testid="product-delete-notice"
          className="rounded-lg border border-[#c9a15a]/50 bg-[#fbf3e3] px-3.5 py-2.5 text-[13px] text-[#7a5416]"
        >
          {notice}
        </p>
      ) : null}
      {/* ── Filter bar ─────────────────────────────────────────────── */}
      <div
        role="search"
        aria-label={t("filters.label")}
        className="flex flex-wrap items-center gap-2.5 rounded-[10px] border border-brand-gold/[0.16] bg-white p-3 shadow-[0_1px_2px_rgba(16,28,54,0.03),0_12px_30px_-22px_rgba(16,28,54,0.16)] lg:gap-3 lg:px-3.5 lg:py-3"
      >
        <label className="relative w-full lg:w-auto lg:min-w-[200px] lg:max-w-[380px] lg:flex-1">
          <span className="sr-only">{t("filters.searchLabel")}</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 stroke-[1.7] text-text-secondary"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("filters.search")}
            className={cn(CONTROL, "bg-brand-ivory pe-3 ps-10 placeholder:text-text-secondary")}
          />
        </label>
        <FilterSelect label={t("filters.category")} value={categoryId} onChange={setCategoryId}>
          <option value="all">{t("filters.allCategories")}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label={t("filters.stock")}
          value={stock}
          onChange={(value) => setStock(value as StockFilter)}
        >
          <option value="all">{t("filters.allStock")}</option>
          <option value="inStock">{t("filters.inStock")}</option>
          <option value="soldOut">{t("filters.soldOut")}</option>
        </FilterSelect>
        <FilterSelect
          label={t("filters.status")}
          value={status}
          onChange={(value) => setStatus(value as StatusFilter)}
        >
          <option value="all">{t("filters.allStatus")}</option>
          <option value="visible">{t("filters.visible")}</option>
          <option value="hidden">{t("filters.hidden")}</option>
          <option value="newArrival">{t("filters.newArrival")}</option>
          <option value="bestSeller">{t("filters.bestSeller")}</option>
          <option value="onSale">{t("filters.onSale")}</option>
        </FilterSelect>
        <button
          type="button"
          onClick={clearFilters}
          disabled={!hasFilters}
          className="flex h-11 items-center gap-2 rounded-lg border border-brand-burgundy/[0.1] bg-white px-3.5 text-[13.5px] text-brand-burgundy transition-colors hover:bg-brand-ivory disabled:cursor-default disabled:opacity-55 lg:ms-auto lg:h-[38px]"
        >
          <RotateCcw aria-hidden="true" className="size-[15px] stroke-[1.7]" />
          {t("filters.clear")}
        </button>
      </div>

      <p className="sr-only" aria-live="polite">
        {t("filters.showing", { shown: filtered.length, total: products.length })}
      </p>

      {products.length === 0 || filtered.length === 0 ? (
        <p className="rounded-[10px] border border-brand-gold/[0.16] bg-white px-6 py-12 text-center text-[14px] text-text-secondary">
          {products.length === 0 ? t("empty") : t("noMatches")}
        </p>
      ) : (
        <>
          {/* ── Desktop table (xl+) ─────────────────────────────────── */}
          <div className="hidden rounded-[10px] border border-brand-gold/[0.16] bg-white shadow-[0_1px_2px_rgba(16,28,54,0.03),0_12px_30px_-22px_rgba(16,28,54,0.16)] xl:block">
            <table className="w-full table-fixed border-collapse text-start">
              <colgroup>
                <col />
                <col className="w-[10%]" />
                <col className="w-[9%]" />
                <col className="w-[8.5%]" />
                <col className="w-[10%]" />
                <col className="w-[9%]" />
                <col className="w-[9.5%]" />
                <col className="w-[9%]" />
                <col className="w-[108px]" />
              </colgroup>
              <thead>
                <tr className="h-[46px] border-b border-brand-burgundy/[0.07] text-[13px] text-brand-burgundy">
                  {(
                    [
                      "product",
                      "category",
                      "price",
                      "stock",
                      "offer",
                      "visible",
                      "newArrival",
                      "bestSeller",
                    ] as const
                  ).map((key, index) => (
                    <th
                      key={key}
                      scope="col"
                      className={cn(
                        "whitespace-nowrap px-3 text-start font-medium",
                        index === 0 && "ps-5",
                        index >= 5 && "text-center",
                      )}
                    >
                      {t(`columns.${key}`)}
                    </th>
                  ))}
                  <th scope="col" className="whitespace-nowrap px-3 pe-5 text-end font-medium">
                    {t("columns.actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const pills = togglePills(row);
                  return (
                    <tr
                      key={row.id}
                      className="h-[60px] border-b border-brand-burgundy/[0.06] last:border-b-0 hover:bg-brand-ivory/70"
                    >
                      <td className="px-3 ps-5">
                        <div className="flex items-center gap-3">
                          <Thumbnail src={row.imageUrl} className="size-10" />
                          <Link
                            href={`/admin/products/${row.id}/edit`}
                            className="min-w-0 truncate font-display text-[14px] text-brand-burgundy hover:underline"
                          >
                            {row.name}
                          </Link>
                        </div>
                      </td>
                      <td className="truncate px-3 text-[13px] text-text-secondary">
                        {row.categoryName}
                      </td>
                      <td
                        dir="ltr"
                        className="px-3 text-start text-[14px] lining-nums tabular-nums text-brand-burgundy rtl:text-right [font-family:var(--font-playfair),serif]"
                      >
                        {formatCurrency(row.price, currencyLocale)}
                      </td>
                      <td className="px-3">{stockValue(row)}</td>
                      <td className="px-3">{offerPill(row)}</td>
                      <td className="px-3 text-center">{pills.visible}</td>
                      <td className="px-3 text-center">{pills.newArrival}</td>
                      <td className="px-3 text-center">{pills.bestSeller}</td>
                      <td className="px-3 pe-5">{actions(row)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Card list (below xl) ───────────────────────────────── */}
          <ul className="flex flex-col gap-3 xl:hidden">
            {filtered.map((row) => {
              const pills = togglePills(row);
              return (
                <li
                  key={row.id}
                  data-testid="admin-row"
                  className="rounded-[10px] border border-brand-gold/[0.16] bg-white p-3.5 shadow-[0_1px_2px_rgba(16,28,54,0.03)]"
                >
                  <div className="flex items-start gap-3">
                    <Thumbnail src={row.imageUrl} className="size-14" />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/admin/products/${row.id}/edit`}
                        className="line-clamp-2 font-display text-[15px] leading-snug text-brand-burgundy hover:underline"
                      >
                        {row.name}
                      </Link>
                      <p className="mt-1 text-[12.5px] text-text-secondary">{row.categoryName}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span
                          dir="ltr"
                          className="text-[14px] lining-nums tabular-nums text-brand-burgundy"
                        >
                          {formatCurrency(row.price, currencyLocale)}
                        </span>
                        <span className="flex items-center gap-1.5 text-[12.5px] text-text-secondary">
                          {t("columns.stock")}: {stockValue(row)}
                        </span>
                      </div>
                    </div>
                    {actions(row)}
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-brand-burgundy/[0.06] pt-3 text-[12px] text-text-secondary sm:grid-cols-4">
                    <div className="flex flex-col items-start gap-1">
                      <dt>{t("columns.offer")}</dt>
                      <dd>{offerPill(row)}</dd>
                    </div>
                    <div className="flex flex-col items-start gap-1">
                      <dt>{t("columns.visible")}</dt>
                      <dd>{pills.visible}</dd>
                    </div>
                    <div className="flex flex-col items-start gap-1">
                      <dt>{t("columns.newArrival")}</dt>
                      <dd>{pills.newArrival}</dd>
                    </div>
                    <div className="flex flex-col items-start gap-1">
                      <dt>{t("columns.bestSeller")}</dt>
                      <dd>{pills.bestSeller}</dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="relative min-w-0 flex-1 basis-[calc(50%-0.625rem)] sm:basis-0 lg:w-[150px] lg:flex-none min-[90rem]:w-[172px]">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(CONTROL, "cursor-pointer appearance-none pe-9 ps-3.5")}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 stroke-[1.7] text-brand-burgundy"
      />
    </label>
  );
}

function RowMenu({
  open,
  onOpenChange,
  label,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  children: React.ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) onOpenChange(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onOpenChange(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className="grid size-9 place-items-center rounded-lg border border-brand-burgundy/[0.1] bg-white text-brand-burgundy transition-colors hover:border-brand-gold/50 hover:bg-brand-ivory lg:size-8"
      >
        <Ellipsis aria-hidden="true" className="size-4" />
      </button>
      {open ? (
        <div className="absolute end-0 top-full z-20 mt-1.5 w-48 rounded-xl border border-brand-burgundy/[0.08] bg-white p-1.5 text-start shadow-elev-3">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function Thumbnail({ src, className }: { src: string | null; className: string }) {
  return (
    <span className={cn("relative shrink-0 overflow-hidden rounded-md bg-brand-cream", className)}>
      {src ? <Image src={src} alt="" fill sizes="56px" className="object-cover" /> : null}
    </span>
  );
}
