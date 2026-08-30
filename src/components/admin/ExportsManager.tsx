"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ORDER_STATUSES } from "@/types/order";
import { DELIVERY_REGION_IDS } from "@/types/deliveryRegion";

export type ExportCategoryOption = { id: string; nameEn: string };

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

const REPORTS: { type: ReportType; label: string; filters: FilterKind }[] = [
  { type: "orders", label: "Orders", filters: "orderFilters" },
  { type: "products", label: "Products", filters: "categoryId" },
  { type: "inventory", label: "Inventory / Stock", filters: "lowStockThreshold" },
  { type: "sold-out", label: "SOLD OUT Products", filters: "none" },
  { type: "customers", label: "Customers", filters: "none" },
  { type: "sales", label: "Sales", filters: "dateRange" },
  { type: "best-sellers", label: "Best-Selling Products", filters: "dateRange" },
  { type: "delivery-locations", label: "Delivery Locations", filters: "none" },
];

/**
 * `/admin/exports` (T303, T305, spec FR-099/FR-108). A report-type picker
 * with each report's relevant filter controls, downloading a real `.xlsx`
 * from the matching `/admin/api/export/*` Route Handler. Every download
 * goes through `fetch()` (not a plain `<a href>`) specifically so this
 * component can show a clear in-progress/completion/error state (T305,
 * spec FR-112) — a large report never appears to just hang with no
 * feedback.
 */
export function ExportsManager({ categories }: { categories: ExportCategoryOption[] }) {
  const [reportType, setReportType] = useState<ReportType>("orders");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");
  const [regionId, setRegionId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeReport = useMemo(() => REPORTS.find((r) => r.type === reportType)!, [reportType]);

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
    setPending(true);
    setError(null);
    try {
      const response = await fetch(buildUrl());
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.message ?? `Export failed (${response.status}).`);
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
      setError("Export failed. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:max-w-xs">
        <label htmlFor="report-type" className="text-sm font-medium text-text-primary">
          Report type
        </label>
        <select
          id="report-type"
          value={reportType}
          onChange={(e) => setReportType(e.target.value as ReportType)}
          className="block min-h-11 rounded-md border border-border-luxury bg-brand-ivory px-3 py-2 text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-burgundy"
        >
          {REPORTS.map((report) => (
            <option key={report.type} value={report.type}>
              {report.label}
            </option>
          ))}
        </select>
      </div>

      {activeReport.filters === "orderFilters" && (
        <div className="grid gap-4 sm:grid-cols-2 sm:max-w-lg">
          <DateField id="orders-from" label="From" value={from} onChange={setFrom} />
          <DateField id="orders-to" label="To" value={to} onChange={setTo} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="orders-status" className="text-sm font-medium text-text-primary">
              Status
            </label>
            <select
              id="orders-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="block min-h-11 rounded-md border border-border-luxury bg-brand-ivory px-3 py-2 text-text-primary"
            >
              <option value="">All statuses</option>
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="orders-region" className="text-sm font-medium text-text-primary">
              Region
            </label>
            <select
              id="orders-region"
              value={regionId}
              onChange={(e) => setRegionId(e.target.value)}
              className="block min-h-11 rounded-md border border-border-luxury bg-brand-ivory px-3 py-2 text-text-primary"
            >
              <option value="">All regions</option>
              {DELIVERY_REGION_IDS.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {activeReport.filters === "dateRange" && (
        <div className="grid gap-4 sm:grid-cols-2 sm:max-w-md">
          <DateField id="range-from" label="From" value={from} onChange={setFrom} />
          <DateField id="range-to" label="To" value={to} onChange={setTo} />
        </div>
      )}

      {activeReport.filters === "categoryId" && (
        <div className="flex flex-col gap-1.5 sm:max-w-xs">
          <label htmlFor="products-category" className="text-sm font-medium text-text-primary">
            Category (optional)
          </label>
          <select
            id="products-category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="block min-h-11 rounded-md border border-border-luxury bg-brand-ivory px-3 py-2 text-text-primary"
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.nameEn}
              </option>
            ))}
          </select>
        </div>
      )}

      {activeReport.filters === "lowStockThreshold" && (
        <div className="flex flex-col gap-1.5 sm:max-w-xs">
          <label htmlFor="inventory-threshold" className="text-sm font-medium text-text-primary">
            Low-stock threshold (optional)
          </label>
          <input
            id="inventory-threshold"
            type="number"
            min={0}
            value={lowStockThreshold}
            onChange={(e) => setLowStockThreshold(e.target.value)}
            placeholder="e.g. 5 — only products at or below this stock"
            className="block min-h-11 rounded-md border border-border-luxury bg-brand-ivory px-3 py-2 text-text-primary"
          />
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={handleDownload} disabled={pending} aria-busy={pending}>
          {pending ? "Preparing export…" : `Download ${activeReport.label}`}
        </Button>
        {pending && (
          <span role="status" className="text-sm text-text-primary/70">
            Generating your report — this may take a moment for a large report.
          </span>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
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
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-text-primary">
        {label}
      </label>
      <input
        id={id}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block min-h-11 rounded-md border border-border-luxury bg-brand-ivory px-3 py-2 text-text-primary"
      />
    </div>
  );
}
