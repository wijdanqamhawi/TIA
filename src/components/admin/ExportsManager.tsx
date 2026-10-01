"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Award,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Info,
  MapPin,
  Package,
  PackageX,
  ShoppingCart,
  TrendingUp,
  User,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { DirectionalIcon } from "@/components/ui/DirectionalIcon";
import { ORDER_STATUSES } from "@/types/order";
import { DELIVERY_REGION_IDS } from "@/types/deliveryRegion";

export type ExportCategoryOption = { id: string; nameEn: string; nameAr?: string | null };

type ReportType =
  | "orders"
  | "products"
  | "inventory"
  | "sold-out"
  | "customers"
  | "sales"
  | "best-sellers"
  | "delivery-locations";

type FilterKind = "dateRange" | "categoryId" | "lowStockThreshold" | "orderFilters" | "none";

/** The REAL report types the export Route Handlers support, each with the filters they accept. */
const REPORTS: { type: ReportType; filters: FilterKind; icon: LucideIcon }[] = [
  { type: "orders", filters: "orderFilters", icon: ShoppingCart },
  { type: "products", filters: "categoryId", icon: Package },
  { type: "inventory", filters: "lowStockThreshold", icon: Warehouse },
  { type: "sold-out", filters: "none", icon: PackageX },
  { type: "customers", filters: "none", icon: User },
  { type: "sales", filters: "dateRange", icon: TrendingUp },
  { type: "best-sellers", filters: "dateRange", icon: Award },
  { type: "delivery-locations", filters: "none", icon: MapPin },
];

/** The three headline cards, in the order shown. */
const CARD_TYPES = ["orders", "customers", "products"] as const satisfies readonly ReportType[];
/** The quick-access actions at the bottom. */
const QUICK_TYPES = ["customers", "products", "orders"] as const satisfies readonly ReportType[];

const SURFACE =
  "rounded-[10px] border border-brand-gold/[0.16] bg-white shadow-[0_1px_2px_rgba(16,28,54,0.03),0_12px_30px_-22px_rgba(16,28,54,0.16)]";
const CONTROL =
  "block h-11 w-full rounded-lg border border-brand-burgundy/[0.1] bg-white px-3 text-[13.5px] text-brand-burgundy transition-colors focus-visible:border-brand-gold/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/30 lg:h-[40px]";
const ICON_DISC =
  "grid shrink-0 place-items-center rounded-full bg-brand-gold/[0.14] text-brand-gold-ink";
const LABEL = "text-[13px] font-medium text-brand-burgundy";

const byType = (type: ReportType) => REPORTS.find((report) => report.type === type)!;

/**
 * `/admin/exports` (T303, T305, spec FR-099/FR-108). Three headline report cards, a Generate Report card
 * (report type + that report's own filters on one side, the .xlsx information panel on the other) and
 * quick-access actions. Selecting a card, the dropdown or a quick action all set the SAME `reportType`
 * state, so there is one export path: the matching `/admin/api/export/*` Route Handler, fetched (not a
 * plain link) so a large report shows a clear in-progress/completion/error state (T305, spec FR-112).
 * Only the filters each report really supports are offered; nothing is invented.
 */
export function ExportsManager({ categories }: { categories: ExportCategoryOption[] }) {
  const t = useTranslations("AdminExports");
  const locale = useLocale();
  const [reportType, setReportType] = useState<ReportType>("orders");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");
  const [regionId, setRegionId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeReport = useMemo(() => byType(reportType), [reportType]);
  const ActiveIcon = activeReport.icon;
  const reportLabel = (type: ReportType) => t(`reports.${type}`);

  function selectReport(type: ReportType) {
    setReportType(type);
    setError(null);
  }

  function buildUrl(): string {
    const params = new URLSearchParams();
    if (activeReport.filters === "orderFilters") {
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (status) params.set("status", status);
      if (regionId) params.set("regionId", regionId);
    } else if (activeReport.filters === "dateRange") {
      if (from) params.set("from", from);
      if (to) params.set("to", to);
    } else if (activeReport.filters === "categoryId") {
      if (categoryId) params.set("categoryId", categoryId);
    } else if (activeReport.filters === "lowStockThreshold") {
      if (lowStockThreshold) params.set("lowStockThreshold", lowStockThreshold);
    }
    const query = params.toString();
    return `/admin/api/export/${reportType}${query ? `?${query}` : ""}`;
  }

  async function handleDownload() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(buildUrl());
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.message ?? t("errors.failed", { status: response.status }));
        return;
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `${reportType}.xlsx`;

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setError(t("errors.generic"));
    } finally {
      setPending(false);
    }
  }

  const xlsx = <bdi dir="ltr">.xlsx</bdi>;

  return (
    <div className="flex flex-col gap-4">
      {/* ── The three headline report types ─────────────────────────────── */}
      <div
        role="radiogroup"
        aria-label={t("cardsLabel")}
        className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:gap-[13px]"
      >
        {CARD_TYPES.map((type) => {
          const { icon: Icon } = byType(type);
          const selected = reportType === type;
          return (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={selected}
              data-testid={`report-card-${type}`}
              data-selected={selected}
              onClick={() => selectReport(type)}
              className={cn(
                "flex items-center gap-3.5 rounded-[10px] border p-4 text-start outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-gold/50 md:flex-col md:items-start lg:flex-row lg:items-center",
                selected
                  ? "border-brand-gold bg-[#fffaf0] shadow-[0_10px_24px_-18px_rgba(196,164,107,0.9)]"
                  : "border-brand-gold/[0.16] bg-white shadow-[0_1px_2px_rgba(16,28,54,0.03)] hover:border-brand-gold/50",
              )}
            >
              <span className={cn(ICON_DISC, "size-11", selected && "bg-brand-gold/[0.22]")}>
                <Icon aria-hidden="true" className="size-5 stroke-[1.5]" />
              </span>
              <span className="min-w-0">
                <span className="block font-display text-[19px] leading-tight text-brand-burgundy">
                  {reportLabel(type)}
                </span>
                <span className="mt-1 block text-[13px] leading-snug text-text-secondary">
                  {t(`cards.${type}`)}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Generate Report ─────────────────────────────────────────────── */}
      <section
        aria-labelledby="exports-generate-title"
        className={cn(
          SURFACE,
          "grid grid-cols-1 gap-6 p-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,340px)] xl:gap-8 lg:p-6",
        )}
      >
        <div className="min-w-0">
          <h2
            id="exports-generate-title"
            className="font-display text-[24px] leading-tight text-brand-burgundy"
          >
            {t("generate.title")}
          </h2>
          <p className="mt-1 text-[13.5px] text-text-secondary">{t("generate.subtitle")}</p>

          <div className="mt-5 flex flex-col gap-4 lg:max-w-[600px]">
            <div className="flex flex-col gap-1.5 sm:max-w-[320px]">
              <label htmlFor="report-type" className={LABEL}>
                {t("fields.reportType")}
              </label>
              <span className="relative block">
                <span
                  className={cn(
                    ICON_DISC,
                    "pointer-events-none absolute start-2 top-1/2 size-7 -translate-y-1/2",
                  )}
                >
                  <ActiveIcon aria-hidden="true" className="size-3.5 stroke-[1.6]" />
                </span>
                <select
                  id="report-type"
                  value={reportType}
                  onChange={(e) => selectReport(e.target.value as ReportType)}
                  className={cn(CONTROL, "cursor-pointer appearance-none ps-12 pe-9")}
                >
                  {REPORTS.map((report) => (
                    <option key={report.type} value={report.type}>
                      {reportLabel(report.type)}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  aria-hidden="true"
                  className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 stroke-[1.6] text-brand-burgundy"
                />
              </span>
            </div>

            {activeReport.filters === "orderFilters" && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" data-testid="filters-orders">
                <DateField
                  id="orders-from"
                  label={t("fields.from")}
                  value={from}
                  onChange={setFrom}
                />
                <DateField id="orders-to" label={t("fields.to")} value={to} onChange={setTo} />
                <SelectField
                  id="orders-status"
                  label={t("fields.status")}
                  value={status}
                  onChange={setStatus}
                  placeholder={t("fields.allStatuses")}
                  options={ORDER_STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) }))}
                />
                <SelectField
                  id="orders-region"
                  label={t("fields.region")}
                  value={regionId}
                  onChange={setRegionId}
                  placeholder={t("fields.allRegions")}
                  options={DELIVERY_REGION_IDS.map((id) => ({
                    value: id,
                    label: t(`regions.${id}`),
                  }))}
                />
              </div>
            )}

            {activeReport.filters === "dateRange" && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" data-testid="filters-range">
                <DateField
                  id="range-from"
                  label={t("fields.from")}
                  value={from}
                  onChange={setFrom}
                />
                <DateField id="range-to" label={t("fields.to")} value={to} onChange={setTo} />
              </div>
            )}

            {activeReport.filters === "categoryId" && (
              <div className="sm:max-w-[320px]" data-testid="filters-category">
                <SelectField
                  id="products-category"
                  label={t("fields.category")}
                  value={categoryId}
                  onChange={setCategoryId}
                  placeholder={t("fields.allCategories")}
                  options={categories.map((c) => ({
                    value: c.id,
                    label: locale === "ar" ? c.nameAr || c.nameEn : c.nameEn,
                  }))}
                />
              </div>
            )}

            {activeReport.filters === "lowStockThreshold" && (
              <div
                className="flex flex-col gap-1.5 sm:max-w-[420px]"
                data-testid="filters-threshold"
              >
                <label htmlFor="inventory-threshold" className={LABEL}>
                  {t("fields.lowStock")}
                </label>
                <input
                  id="inventory-threshold"
                  type="number"
                  min={0}
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(e.target.value)}
                  placeholder={t("fields.lowStockPlaceholder")}
                  className={CONTROL}
                />
              </div>
            )}

            {activeReport.filters === "none" && (
              <p data-testid="filters-none" className="text-[13px] text-text-secondary">
                {t("fields.noFilters")}
              </p>
            )}

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={handleDownload}
                disabled={pending}
                aria-busy={pending}
                data-testid="download-button"
                className="inline-flex h-[50px] w-full items-center justify-between gap-3 rounded-lg bg-brand-burgundy px-5 text-[15px] font-medium text-text-on-dark shadow-[0_10px_22px_-14px_rgba(16,28,54,0.75)] outline-none transition-colors hover:bg-brand-burgundy-light focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70 sm:max-w-[380px]"
              >
                <span className="inline-flex items-center gap-2.5">
                  <Download aria-hidden="true" className="size-[18px] stroke-[1.8]" />
                  {pending
                    ? t("preparing")
                    : t("downloadReport", { report: reportLabel(reportType) })}
                </span>
                <span className="text-[13px] font-normal opacity-80">{xlsx}</span>
              </button>
              {pending && (
                <span role="status" className="text-[13px] text-text-secondary">
                  {t("generating")}
                </span>
              )}
              {error && (
                <p role="alert" data-testid="export-error" className="text-[13px] text-[#a23f36]">
                  {error}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* The .xlsx information panel: beside the form on desktop, below it on tablet and mobile. */}
        <aside
          aria-label=".xlsx"
          data-testid="xlsx-panel"
          className="flex min-w-0 flex-col gap-4 rounded-[10px] bg-[#fbf7ee] p-4 lg:p-5"
        >
          <div className="flex items-center gap-3">
            <span className={cn(ICON_DISC, "size-11")}>
              <FileSpreadsheet aria-hidden="true" className="size-5 stroke-[1.5]" />
            </span>
            <h3 className="font-display text-[20px] leading-tight text-brand-burgundy">
              {t.rich("panel.title", { ext: (chunks) => <bdi dir="ltr">{chunks}</bdi> })}
            </h3>
          </div>
          <ul className="flex flex-col gap-2.5 text-[13.5px] text-brand-burgundy">
            {(["live", "real", "noImport"] as const).map((key) => (
              <li key={key} className="flex items-start gap-2.5">
                <span className={cn(ICON_DISC, "mt-px size-5")}>
                  <Check aria-hidden="true" className="size-3 stroke-[2.4]" />
                </span>
                <span className="leading-snug">{t(`panel.${key}`)}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-start gap-2.5 rounded-lg border border-brand-burgundy/[0.06] bg-[#f2f3f5] p-3 text-[13px] leading-snug text-text-secondary">
            <Info
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 stroke-[1.6] text-brand-burgundy"
            />
            <p>{t("panel.hint")}</p>
          </div>
        </aside>
      </section>

      {/* ── Other reports ───────────────────────────────────────────────── */}
      <section
        aria-labelledby="exports-other-title"
        className={cn(
          SURFACE,
          "flex flex-col gap-4 p-5 lg:p-5 xl:flex-row xl:items-center xl:justify-between xl:gap-6",
        )}
      >
        <div className="min-w-0 xl:shrink-0">
          <h2
            id="exports-other-title"
            className="font-display text-[22px] leading-tight text-brand-burgundy"
          >
            {t("other.title")}
          </h2>
          <p className="mt-1 text-[13.5px] text-text-secondary">{t("other.subtitle")}</p>
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3 xl:flex-1 xl:max-w-[880px]">
          {QUICK_TYPES.map((type) => {
            const { icon: Icon } = byType(type);
            return (
              <button
                key={type}
                type="button"
                data-testid={`quick-${type}`}
                // The accessible name is just "Export X", so the one real Download button stays unambiguous.
                aria-label={t("other.export", { report: reportLabel(type) })}
                onClick={() => selectReport(type)}
                className="flex min-w-0 items-center gap-3 rounded-lg border border-brand-gold/[0.2] bg-white p-3 text-start outline-none transition-colors hover:border-brand-gold/60 hover:bg-brand-ivory focus-visible:ring-2 focus-visible:ring-brand-gold/50"
              >
                <span className={cn(ICON_DISC, "size-10")}>
                  <Icon aria-hidden="true" className="size-[18px] stroke-[1.5]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-brand-burgundy">
                    {t("other.export", { report: reportLabel(type) })}
                  </span>
                  <span className="block text-[12.5px] text-text-secondary">
                    {t("download")} {xlsx}
                  </span>
                </span>
                <DirectionalIcon
                  icon={ChevronRight}
                  aria-hidden="true"
                  className="size-4 shrink-0 text-brand-burgundy"
                />
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function DateField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <input
        id={id}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={CONTROL}
      />
    </div>
  );
}

function SelectField({
  id,
  label,
  value,
  onChange,
  placeholder,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <span className="relative block">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(CONTROL, "cursor-pointer appearance-none pe-9")}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 stroke-[1.6] text-brand-burgundy"
        />
      </span>
    </div>
  );
}
