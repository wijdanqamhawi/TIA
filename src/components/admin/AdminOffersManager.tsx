"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  BadgeCheck,
  CalendarClock,
  CalendarX,
  ChevronDown,
  ExternalLink,
  Info,
  Loader2,
  Pencil,
  Plus,
  Power,
  PowerOff,
  RotateCcw,
  Search,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/currency";
import { FormError } from "@/components/ui/FormError";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { BulkActionButton } from "@/components/admin/BulkActionButton";
import { StatCard } from "@/components/admin/StatCard";
import {
  AdminDrawer,
  DRAWER_ACTION as ACTION,
  DRAWER_FIELD as FIELD,
  DRAWER_LABEL as LABEL,
} from "@/components/admin/AdminDrawer";
import { updateProductAction } from "@/actions/admin/product.actions";
import {
  DISCOUNT_ERROR_KEY,
  initialDiscountInput,
  resolveOfferSalePrice,
} from "@/lib/domain/catalog/offer-discount";
import {
  computeOfferStats,
  discountPercent,
  filterOffers,
  getOfferToggle,
  offerToggleInput,
  toDateTimeLocalValue,
  type ListedOfferStatus,
  type OfferProductChoice,
  type OfferRow,
  type OfferStatusFilter,
  type OfferToggle,
} from "@/lib/domain/admin/offer-list";

type DrawerState = { mode: "create" } | { mode: "edit"; offer: OfferRow } | null;

const SURFACE =
  "rounded-[10px] border border-brand-gold/[0.16] bg-white shadow-[0_1px_2px_rgba(16,28,54,0.03),0_12px_30px_-22px_rgba(16,28,54,0.16)]";
const CONTROL =
  "h-11 w-full rounded-lg border border-brand-burgundy/[0.1] bg-white text-[13.5px] text-brand-burgundy transition-colors focus-visible:border-brand-gold/70 focus-visible:outline-none lg:h-[38px]";

const STATUS_TONE: Record<ListedOfferStatus, { pill: string; dot: string }> = {
  ACTIVE: { pill: "bg-[#e6f0e9] text-[#2f6844]", dot: "bg-[#3f7a55]" },
  SCHEDULED: { pill: "bg-[#e8edf6] text-[#2f4a7a]", dot: "bg-[#4a6ba3]" },
  EXPIRED: { pill: "bg-brand-cream text-text-secondary", dot: "bg-text-secondary/60" },
  DISABLED: { pill: "bg-[#f6ecea] text-[#8f4a43]", dot: "bg-[#c0574d]" },
};

/**
 * Admin — Special Offers. Lists every product with a promotional price
 * (Active / Scheduled / Expired, derived on the server from the product's own
 * offer fields) with summary cards, search and a status filter. The New Offer
 * and Edit drawers save through the existing `updateProductAction` — the same
 * action, and the same product fields, as the product form's offer section.
 */
export function AdminOffersManager({
  offers,
  choices,
}: {
  offers: OfferRow[];
  choices: OfferProductChoice[];
}) {
  const t = useTranslations("AdminOffers");
  const locale = useLocale() === "ar" ? "ar" : "en";
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<OfferStatusFilter>("all");

  const router = useRouter();

  // Stopping / starting an offer only flips the product's existing `isOnSale` flag; the status pill,
  // the filter and the summary cards all show the *derived* status, optimistically while saving and
  // from the server's fresh rows afterwards. A failed save drops the optimistic value (rollback).
  const [overrides, setOverrides] = useState<
    Record<string, { status: OfferRow["status"]; isOnSale: boolean }>
  >({});
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{
    offer: OfferRow;
    toggle: Extract<OfferToggle, { kind: "stop" | "start" }>;
  } | null>(null);
  const inFlight = useRef(new Set<string>());

  // Fresh server rows (after `router.refresh()`) are the source of truth again, except for an
  // offer whose save is still in flight.
  const [source, setSource] = useState(offers);
  if (source !== offers) {
    setSource(offers);
    setOverrides((current) =>
      Object.fromEntries(Object.entries(current).filter(([id]) => pendingIds.has(id))),
    );
  }

  const rows = useMemo(
    () =>
      offers.map((offer) => {
        const override = overrides[offer.productId];
        return override ? { ...offer, ...override } : offer;
      }),
    [offers, overrides],
  );
  const stats = useMemo(() => computeOfferStats(rows), [rows]);
  const filtered = useMemo(() => filterOffers(rows, { query, status }), [rows, query, status]);
  const hasFilters = query.trim() !== "" || status !== "all";
  const money = (minor: number) => formatCurrency(minor, locale === "ar" ? "ar" : "en-US");
  const dateTime = new Intl.DateTimeFormat(locale === "ar" ? "ar-u-nu-latn" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Hebron",
  });
  const when = (ms: number | null, fallback: string) =>
    ms === null ? fallback : dateTime.format(new Date(ms));

  function clearFilters() {
    setQuery("");
    setStatus("all");
  }

  /** A click on an ACTIVE / DISABLED pill: ask first (stop / start), or explain why it cannot start. */
  function handleStatusClick(offer: OfferRow) {
    if (inFlight.current.has(offer.productId)) return;
    const toggle = getOfferToggle(offer, Date.now());
    if (toggle.kind === "blocked") {
      setNotice(t(`toggle.errors.${toggle.reason}`));
      return;
    }
    if (toggle.kind === "stop" || toggle.kind === "start") {
      setNotice(null);
      setConfirm({ offer, toggle });
    }
  }

  async function confirmToggle() {
    if (!confirm) return;
    const { offer, toggle } = confirm;
    setConfirm(null);
    if (inFlight.current.has(offer.productId)) return; // no double submits
    inFlight.current.add(offer.productId);
    setNotice(null);
    setOverrides((current) => ({
      ...current,
      [offer.productId]: {
        status: toggle.kind === "stop" ? "DISABLED" : toggle.resultingStatus,
        isOnSale: toggle.kind === "start",
      },
    }));
    setPendingIds((current) => new Set(current).add(offer.productId));

    const rollback = () => {
      setOverrides(({ [offer.productId]: _dropped, ...rest }) => rest);
      setNotice(t("toggle.errors.failed"));
    };
    try {
      // The existing, protected action: only `isOnSale` changes (a start repeats the stored sale
      // price, which the schema requires); the product, its sale price and its dates are untouched.
      const result = await updateProductAction(offerToggleInput(offer, toggle));
      if (result.ok) router.refresh();
      else rollback();
    } catch {
      rollback();
    } finally {
      inFlight.current.delete(offer.productId);
      setPendingIds((current) => {
        const next = new Set(current);
        next.delete(offer.productId);
        return next;
      });
    }
  }

  const cards = [
    { key: "total", value: stats.total, icon: Tag, tone: "gold" },
    { key: "active", value: stats.active, icon: BadgeCheck, tone: "green" },
    { key: "scheduled", value: stats.scheduled, icon: CalendarClock, tone: "blue" },
    { key: "expired", value: stats.expired, icon: CalendarX, tone: "red" },
    { key: "disabled", value: stats.disabled, icon: PowerOff, tone: "gold" },
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pt-1">
        <div className="min-w-0">
          <h1 className="font-display text-[32px] font-normal leading-[1.1] text-brand-burgundy lg:text-[38px] rtl:text-[28px] rtl:leading-[1.4] rtl:lg:text-[32px]">
            {t("title")}
          </h1>
          <p className="mt-1.5 font-display text-[15px] leading-snug text-text-secondary lg:text-[16px] rtl:font-body rtl:text-[14.5px]">
            {t("subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-3">
          <BulkActionButton kind="offers" count={offers.length} />
          <div className="flex flex-col items-start gap-1.5 sm:items-end">
            <button
              type="button"
              onClick={() => setDrawer({ mode: "create" })}
              disabled={choices.length === 0}
              aria-describedby={choices.length === 0 ? "offers-new-unavailable" : undefined}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-burgundy px-5 text-[14.5px] font-medium text-text-on-dark shadow-[0_8px_20px_-12px_rgba(16,28,54,0.6)] transition-colors hover:bg-brand-burgundy-light disabled:cursor-not-allowed disabled:bg-brand-cream disabled:text-text-secondary disabled:shadow-none"
            >
              <Plus aria-hidden="true" className="size-[17px] stroke-[2]" />
              {t("newOffer")}
            </button>
            {choices.length === 0 ? (
              <p
                id="offers-new-unavailable"
                className="max-w-[320px] text-[12px] text-text-secondary sm:text-end"
              >
                {t("noProductsAvailable")}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-[13px] xl:grid-cols-5">
        {cards.map((card) => (
          <StatCard
            key={card.key}
            label={t(`stats.${card.key}`)}
            value={card.value}
            icon={card.icon}
            tone={card.tone}
          />
        ))}
      </div>

      {/* ── Search / filter bar (client-side over the loaded offers) ───────── */}
      <div
        role="search"
        aria-label={t("filters.label")}
        className={cn(
          SURFACE,
          "flex flex-wrap items-center gap-2.5 p-3 lg:gap-3 lg:px-3.5 lg:py-3",
        )}
      >
        <label className="relative w-full lg:w-auto lg:min-w-[220px] lg:max-w-[380px] lg:flex-1">
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
        <label className="relative min-w-0 flex-1 basis-[calc(50%-0.625rem)] sm:basis-0 lg:w-[180px] lg:flex-none">
          <span className="sr-only">{t("filters.status")}</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as OfferStatusFilter)}
            className={cn(CONTROL, "cursor-pointer appearance-none pe-9 ps-3.5")}
          >
            <option value="all">{t("filters.allStatuses")}</option>
            <option value="ACTIVE">{t("status.ACTIVE")}</option>
            <option value="SCHEDULED">{t("status.SCHEDULED")}</option>
            <option value="EXPIRED">{t("status.EXPIRED")}</option>
            <option value="DISABLED">{t("status.DISABLED")}</option>
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 stroke-[1.7] text-brand-burgundy"
          />
        </label>
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

      {notice ? (
        <p
          role="alert"
          className="rounded-lg bg-[#fbeeec] px-3.5 py-2.5 text-[13px] text-[#9a3f36]"
        >
          {notice}
        </p>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState t={t} filtered={hasFilters} onClear={clearFilters} />
      ) : (
        <>
          {/* ── Desktop table (xl+) ─────────────────────────────────────── */}
          <div className={cn(SURFACE, "hidden xl:block")}>
            <table className="w-full table-fixed border-collapse text-start">
              <colgroup>
                <col />
                <col className="w-[11%]" />
                <col className="w-[11%]" />
                <col className="w-[9%]" />
                <col className="w-[15%]" />
                <col className="w-[15%]" />
                <col className="w-[11%]" />
                <col className="w-[76px]" />
              </colgroup>
              <thead>
                <tr className="h-[46px] border-b border-brand-burgundy/[0.07] bg-brand-cream/60 text-[13px] text-brand-burgundy">
                  {(
                    [
                      "product",
                      "regularPrice",
                      "salePrice",
                      "discount",
                      "starts",
                      "ends",
                      "status",
                    ] as const
                  ).map((key, index) => (
                    <th
                      key={key}
                      scope="col"
                      className={cn(
                        "whitespace-nowrap px-3 text-start font-medium",
                        index === 0 && "ps-5",
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
                {filtered.map((offer) => {
                  const percent = discountPercent(offer.price, offer.salePrice);
                  return (
                    <tr
                      key={offer.productId}
                      data-testid="admin-row"
                      className="h-[64px] border-b border-brand-burgundy/[0.06] last:border-b-0 hover:bg-brand-ivory/70"
                    >
                      <td className="px-3 ps-5">
                        <div className="flex min-w-0 items-center gap-3">
                          <Thumbnail src={offer.imageUrl} className="size-10" />
                          <button
                            type="button"
                            id={`offer-name-${offer.productId}`}
                            onClick={() => setDrawer({ mode: "edit", offer })}
                            className="min-w-0 truncate text-start font-display text-[14px] text-brand-burgundy hover:underline"
                          >
                            {offer.name}
                          </button>
                        </div>
                      </td>
                      <td
                        dir="ltr"
                        className="px-3 text-start text-[13.5px] lining-nums tabular-nums text-text-secondary line-through decoration-text-secondary/50 rtl:text-right"
                      >
                        {money(offer.price)}
                      </td>
                      <td
                        dir="ltr"
                        className="px-3 text-start text-[14px] lining-nums tabular-nums text-brand-burgundy rtl:text-right [font-family:var(--font-playfair),serif]"
                      >
                        {money(offer.salePrice)}
                      </td>
                      <td className="px-3 text-[13px] lining-nums text-brand-burgundy">
                        {percent !== null ? <span dir="ltr">−{percent}%</span> : "—"}
                      </td>
                      <td className="px-3 text-[13px] lining-nums text-brand-burgundy">
                        {when(offer.startAt, t("immediately"))}
                      </td>
                      <td className="px-3 text-[13px] lining-nums text-brand-burgundy">
                        {when(offer.endAt, t("noEnd"))}
                      </td>
                      <td className="px-3">
                        <StatusControl
                          offer={offer}
                          t={t}
                          pending={pendingIds.has(offer.productId)}
                          onClick={() => handleStatusClick(offer)}
                        />
                      </td>
                      <td className="px-3 pe-5">
                        <div className="flex justify-end">
                          <EditButton
                            label={t("edit")}
                            describedBy={`offer-name-${offer.productId}`}
                            onClick={() => setDrawer({ mode: "edit", offer })}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Card list (below xl) ───────────────────────────────────── */}
          <ul className="flex flex-col gap-3 xl:hidden">
            {filtered.map((offer) => {
              const percent = discountPercent(offer.price, offer.salePrice);
              return (
                <li
                  key={offer.productId}
                  data-testid="admin-row"
                  className="rounded-[10px] border border-brand-gold/[0.16] bg-white p-3.5 shadow-[0_1px_2px_rgba(16,28,54,0.03)]"
                >
                  <div className="flex items-start gap-3">
                    <Thumbnail src={offer.imageUrl} className="size-14" />
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        id={`offer-card-name-${offer.productId}`}
                        onClick={() => setDrawer({ mode: "edit", offer })}
                        className="line-clamp-2 text-start font-display text-[15px] leading-snug text-brand-burgundy hover:underline"
                      >
                        {offer.name}
                      </button>
                      <p
                        className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5"
                        dir="ltr"
                      >
                        <span className="text-[15px] lining-nums tabular-nums text-brand-burgundy [font-family:var(--font-playfair),serif]">
                          {money(offer.salePrice)}
                        </span>
                        <span className="text-[12.5px] lining-nums tabular-nums text-text-secondary line-through">
                          {money(offer.price)}
                        </span>
                        {percent !== null ? (
                          <span className="text-[12px] lining-nums text-[#963a33]">
                            −{percent}%
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <EditButton
                      label={t("edit")}
                      describedBy={`offer-card-name-${offer.productId}`}
                      onClick={() => setDrawer({ mode: "edit", offer })}
                    />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-brand-burgundy/[0.06] pt-3 text-[12px] text-text-secondary sm:grid-cols-3">
                    <div className="flex flex-col items-start gap-1">
                      <dt>{t("columns.status")}</dt>
                      <dd>
                        <StatusControl
                          offer={offer}
                          t={t}
                          pending={pendingIds.has(offer.productId)}
                          onClick={() => handleStatusClick(offer)}
                        />
                      </dd>
                    </div>
                    <div className="flex flex-col items-start gap-1">
                      <dt>{t("columns.starts")}</dt>
                      <dd className="text-[13px] lining-nums text-brand-burgundy">
                        {when(offer.startAt, t("immediately"))}
                      </dd>
                    </div>
                    <div className="flex flex-col items-start gap-1">
                      <dt>{t("columns.ends")}</dt>
                      <dd className="text-[13px] lining-nums text-brand-burgundy">
                        {when(offer.endAt, t("noEnd"))}
                      </dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ul>

          <p className="px-1 text-[13px] text-text-secondary lining-nums" aria-live="polite">
            {t("footer.showing", { shown: filtered.length, total: offers.length })}
          </p>
        </>
      )}

      {confirm ? (
        <ConfirmDialog
          titleId="offer-status-title"
          title={confirm.toggle.kind === "stop" ? t("toggle.stopTitle") : t("toggle.startTitle")}
          description={
            confirm.toggle.kind === "stop" ? t("toggle.stopBody") : t("toggle.startBody")
          }
          cancelLabel={t("drawer.cancel")}
          confirmLabel={
            confirm.toggle.kind === "stop" ? t("toggle.stopConfirm") : t("toggle.startConfirm")
          }
          tone={confirm.toggle.kind === "stop" ? "danger" : "default"}
          onCancel={() => setConfirm(null)}
          onConfirm={confirmToggle}
        />
      ) : null}

      {drawer ? (
        <OfferDrawer
          key={drawer.mode === "edit" ? drawer.offer.productId : "create"}
          state={drawer}
          choices={choices}
          onClose={() => setDrawer(null)}
        />
      ) : null}
    </div>
  );
}

/**
 * The status pill. ACTIVE (stop) and DISABLED (start) pills are real buttons — keyboard focusable,
 * with a hover ring, a power glyph and a spoken hint; SCHEDULED and EXPIRED follow their dates, so
 * they stay plain, non-interactive pills.
 */
function StatusControl({
  offer,
  t,
  pending,
  onClick,
}: {
  offer: OfferRow;
  t: ReturnType<typeof useTranslations>;
  pending: boolean;
  onClick: () => void;
}) {
  const tone = STATUS_TONE[offer.status];
  const label = t(`status.${offer.status}`);
  const base = cn(
    "inline-flex h-[26px] items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[12.5px] leading-none",
    tone.pill,
  );
  const inner = (
    <>
      {pending ? (
        <Loader2 aria-hidden="true" className="size-3 shrink-0 animate-spin stroke-[2.2]" />
      ) : (
        <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", tone.dot)} />
      )}
      {label}
    </>
  );

  if (offer.status !== "ACTIVE" && offer.status !== "DISABLED") {
    return (
      <span data-status={offer.status} className={base}>
        {inner}
      </span>
    );
  }

  const hint = offer.status === "ACTIVE" ? t("toggle.stopHint") : t("toggle.startHint");
  // `aria-disabled` rather than `disabled` while saving, so keyboard focus stays on the pill.
  return (
    <button
      type="button"
      data-status={offer.status}
      data-testid="offer-status-toggle"
      onClick={() => {
        if (!pending) onClick();
      }}
      aria-label={pending ? `${label} — ${t("toggle.saving")}` : hint}
      aria-disabled={pending || undefined}
      aria-busy={pending || undefined}
      title={hint}
      className={cn(
        base,
        "cursor-pointer outline-none ring-offset-1 transition-[box-shadow,opacity,filter] hover:ring-1 hover:ring-current/30 focus-visible:ring-2 focus-visible:ring-brand-gold",
        pending && "cursor-wait opacity-70",
      )}
    >
      {inner}
      <Power aria-hidden="true" className="size-3 shrink-0 stroke-[2] opacity-70" />
    </button>
  );
}

function Thumbnail({ src, className }: { src: string | null; className: string }) {
  return (
    <span className={cn("relative shrink-0 overflow-hidden rounded-md bg-brand-cream", className)}>
      {src ? <Image src={src} alt="" fill sizes="56px" className="object-cover" /> : null}
    </span>
  );
}

/** Named just "Edit" (described by the product name) so the name button stays the one control carrying it. */
function EditButton({
  label,
  describedBy,
  onClick,
}: {
  label: string;
  describedBy: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-describedby={describedBy}
      className="grid size-10 shrink-0 place-items-center rounded-lg border border-brand-burgundy/[0.1] bg-white text-brand-burgundy transition-colors hover:border-brand-gold/50 hover:bg-brand-ivory xl:size-9"
    >
      <Pencil aria-hidden="true" className="size-[15px] stroke-[1.7]" />
    </button>
  );
}

function EmptyState({
  t,
  filtered,
  onClear,
}: {
  t: ReturnType<typeof useTranslations>;
  filtered: boolean;
  onClear: () => void;
}) {
  return (
    <div
      data-testid="offers-empty"
      className={cn(
        SURFACE,
        "flex flex-col items-center gap-5 px-6 py-10 text-center sm:flex-row sm:justify-center sm:gap-8 sm:text-start",
      )}
    >
      <span
        aria-hidden="true"
        className="grid size-[88px] shrink-0 place-items-center rounded-full bg-brand-gold/[0.13]"
      >
        <Tag className="size-9 stroke-[1.3] text-brand-gold-ink" />
      </span>
      <div className="flex max-w-[420px] flex-col items-center gap-1.5 sm:items-start">
        <h2 className="font-display text-[20px] leading-tight text-brand-burgundy">
          {t("empty.title")}
        </h2>
        <p className="text-[14px] leading-relaxed text-text-secondary">
          {filtered ? t("empty.filtered") : t("empty.none")}
        </p>
        {filtered ? (
          <button
            type="button"
            onClick={onClear}
            className="mt-2 inline-flex h-10 items-center justify-center rounded-lg border border-brand-gold/50 bg-white px-5 text-[13.5px] font-medium text-brand-burgundy transition-colors hover:border-brand-gold hover:bg-brand-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50"
          >
            {t("filters.clear")}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function OfferDrawer({
  state,
  choices,
  onClose,
}: {
  state: NonNullable<DrawerState>;
  choices: OfferProductChoice[];
  onClose: () => void;
}) {
  const t = useTranslations("AdminOffers");
  const locale = useLocale() === "ar" ? "ar" : "en";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const offer = state.mode === "edit" ? state.offer : null;

  // The saved sale price stays the persisted source; the percentage is derived from it for editing.
  const saved = offer ? { regular: offer.price, salePrice: offer.salePrice } : null;
  const [productId, setProductId] = useState(offer?.productId ?? "");
  const [percentInput, setPercentInput] = useState(initialDiscountInput(saved));
  const [startAt, setStartAt] = useState(toDateTimeLocalValue(offer?.startAt ?? null));
  const [endAt, setEndAt] = useState(toDateTimeLocalValue(offer?.endAt ?? null));
  const [enabled, setEnabled] = useState(offer?.isOnSale ?? true);
  const [error, setError] = useState<string | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);

  const regularPrice = offer
    ? offer.price
    : (choices.find((c) => c.id === productId)?.price ?? null);
  const money = (minor: number) => formatCurrency(minor, locale === "ar" ? "ar" : "en-US");
  const discount = resolveOfferSalePrice({ regular: regularPrice, percentInput, saved });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPriceError(null);

    if (!productId || regularPrice === null) {
      setError(t("errors.productRequired"));
      return;
    }
    // An offer being switched off may leave the discount empty (its sale price is then cleared);
    // anything typed, and every enabled offer, must be a valid discount.
    let salePrice: number | null = null;
    if (discount.ok) {
      salePrice = discount.salePrice;
    } else if (enabled || percentInput.trim() !== "") {
      setPriceError(t(`errors.${DISCOUNT_ERROR_KEY[discount.error]}`));
      return;
    }

    startTransition(async () => {
      let result;
      try {
        result = await updateProductAction({
          productId,
          isOnSale: enabled,
          salePrice,
          saleStartAt: startAt ? new Date(startAt) : null,
          saleEndAt: endAt ? new Date(endAt) : null,
        });
      } catch {
        setError(t("errors.generic"));
        return;
      }
      if (!result.ok) {
        setPriceError(result.error.fieldErrors?.["salePrice"]?.[0] ?? null);
        setError(result.error.fieldErrors?.["salePrice"] ? null : result.error.message);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <AdminDrawer
      titleId="offer-drawer-title"
      title={offer ? t("drawer.editTitle") : t("drawer.addTitle")}
      subtitle={offer ? t("drawer.editSubtitle") : t("drawer.addSubtitle")}
      closeLabel={t("drawer.close")}
      onClose={onClose}
      widthClassName="sm:w-[min(520px,calc(100vw-32px))]"
      titleClassName="text-[24px] sm:text-[26px]"
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-6 pb-3 pt-2">
          {offer ? (
            <div className="flex flex-col gap-1.5">
              <span className={LABEL}>{t("drawer.product")}</span>
              <p className="flex min-h-11 items-center rounded-lg bg-brand-cream px-3.5 text-[14px] text-brand-burgundy">
                {offer.name}
              </p>
            </div>
          ) : (
            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>
                {t("drawer.product")}
                <span aria-hidden="true" className="text-[#b0493f]">
                  {" "}
                  *
                </span>
              </span>
              <span className="relative block">
                <select
                  value={productId}
                  onChange={(event) => setProductId(event.target.value)}
                  required
                  className={cn(FIELD, "cursor-pointer appearance-none pe-10")}
                >
                  <option value="" disabled>
                    {t("drawer.selectProduct")}
                  </option>
                  {choices.map((choice) => (
                    <option key={choice.id} value={choice.id}>
                      {choice.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  aria-hidden="true"
                  className="pointer-events-none absolute end-3.5 top-1/2 size-4 -translate-y-1/2 stroke-[1.7] text-brand-burgundy"
                />
              </span>
            </label>
          )}

          <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className={LABEL}>{t("drawer.regularPrice")}</span>
              <p
                dir="ltr"
                className="flex min-h-11 items-center rounded-lg bg-brand-cream px-3.5 text-[14px] lining-nums text-text-secondary rtl:justify-end"
              >
                {regularPrice === null ? "—" : money(regularPrice)}
              </p>
            </div>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className={LABEL}>{t("drawer.discount")}</span>
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                max="99.99"
                step="0.01"
                dir="ltr"
                value={percentInput}
                onChange={(event) => setPercentInput(event.target.value)}
                aria-describedby="offer-discount-help"
                aria-invalid={Boolean(priceError) || undefined}
                className={cn(FIELD, "lining-nums rtl:text-right")}
              />
            </label>
          </div>
          <p
            id="offer-discount-help"
            className="-mt-2 text-[12.5px] leading-snug text-text-secondary"
          >
            {t("drawer.discountHelp")}
          </p>
          <div className="flex flex-col gap-1.5">
            <span id="offer-sale-price-label" className={LABEL}>
              {t("drawer.salePrice")}{" "}
              <span className="font-normal text-text-secondary">
                ({t("drawer.salePriceCalculated")})
              </span>
            </span>
            <output
              aria-labelledby="offer-sale-price-label"
              data-testid="offer-sale-price"
              dir="ltr"
              className="flex min-h-11 items-center rounded-lg bg-brand-cream px-3.5 text-[15px] lining-nums text-brand-burgundy [font-family:var(--font-playfair),serif] rtl:justify-end"
            >
              {discount.ok ? money(discount.salePrice) : "—"}
            </output>
          </div>
          <FormError message={priceError} className="-mt-2 text-[12.5px]" />

          <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2">
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className={LABEL}>
                {t("drawer.startDate")}{" "}
                <span className="font-normal text-text-secondary">({t("drawer.optional")})</span>
              </span>
              <input
                type="datetime-local"
                dir="ltr"
                value={startAt}
                onChange={(event) => setStartAt(event.target.value)}
                className={cn(FIELD, "rtl:text-right")}
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className={LABEL}>
                {t("drawer.endDate")}{" "}
                <span className="font-normal text-text-secondary">({t("drawer.optional")})</span>
              </span>
              <input
                type="datetime-local"
                dir="ltr"
                value={endAt}
                onChange={(event) => setEndAt(event.target.value)}
                className={cn(FIELD, "rtl:text-right")}
              />
            </label>
          </div>

          {offer ? (
            <div className="flex items-start gap-3">
              <input
                id="offer-enabled"
                type="checkbox"
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
                aria-describedby="offer-enabled-hint"
                className="mt-0.5 size-[18px] shrink-0 cursor-pointer rounded accent-brand-burgundy"
              />
              <div className="min-w-0">
                <label
                  htmlFor="offer-enabled"
                  className="block cursor-pointer text-[14.5px] font-medium text-brand-burgundy"
                >
                  {t("drawer.enabled")}
                </label>
                <p
                  id="offer-enabled-hint"
                  className="mt-0.5 text-[12.5px] leading-snug text-text-secondary"
                >
                  {t("drawer.enabledHint")}
                </p>
              </div>
            </div>
          ) : null}

          <p className="flex items-start gap-2.5 rounded-lg bg-brand-cream px-4 py-3 text-[13px] leading-snug text-brand-burgundy/80">
            <Info
              aria-hidden="true"
              className="mt-px size-[18px] shrink-0 stroke-[1.6] text-brand-burgundy"
            />
            <span>
              {t("drawer.note")}
              {offer ? (
                <>
                  {" "}
                  <Link
                    href={`/admin/products/${offer.productId}/edit`}
                    className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-brand-burgundy underline underline-offset-2"
                  >
                    {t("drawer.openProduct")}
                    <ExternalLink aria-hidden="true" className="size-3.5 rtl:-scale-x-100" />
                  </Link>
                </>
              ) : null}
            </span>
          </p>

          <FormError message={error} className="text-[13px]" />
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-3 border-t border-brand-burgundy/[0.06] px-6 pb-5 pt-4 sm:gap-5">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className={cn(
              ACTION,
              "h-12 border border-brand-gold/50 bg-white text-brand-burgundy outline-none hover:border-brand-gold hover:bg-brand-ivory focus-visible:ring-2 focus-visible:ring-brand-gold/50",
            )}
          >
            {t("drawer.cancel")}
          </button>
          <button
            type="submit"
            disabled={isPending}
            className={cn(
              ACTION,
              "h-12 gap-2.5 bg-brand-burgundy text-text-on-dark outline-none ring-offset-2 hover:bg-brand-burgundy-light focus-visible:ring-2 focus-visible:ring-brand-gold",
            )}
          >
            {isPending ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin stroke-[2]" />
            ) : null}
            {isPending ? t("drawer.saving") : offer ? t("drawer.save") : t("drawer.create")}
          </button>
        </div>
      </form>
    </AdminDrawer>
  );
}
