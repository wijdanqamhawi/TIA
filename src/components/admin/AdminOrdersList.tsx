"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  ChevronDown,
  CircleCheck,
  Clock,
  Eye,
  RotateCcw,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Truck,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/currency";
import { ORDER_STATUSES, type OrderStatus } from "@/types/order";
import { StatCard } from "@/components/admin/StatCard";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { OrderStatusMenu } from "@/components/admin/OrderStatusMenu";
import { updateOrderStatusAction } from "@/actions/admin/order.actions";
import {
  getAllowedNextStatuses,
  isValidOrderStatusTransition,
} from "@/lib/domain/orders/order-status-transitions";
import {
  applyOrderStatusToCounts,
  type OrderSummaryCounts,
} from "@/lib/domain/admin/order-filters";

export type AdminOrderRow = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  /** A guest order has no signed-in customer behind it. */
  isGuest: boolean;
  /** Order creation time, epoch milliseconds. */
  createdAt: number;
  /** Integer minor units. */
  total: number;
  status: OrderStatus;
};

export type OrdersTranslate = (key: string, values?: Record<string, string | number>) => string;

const SURFACE =
  "rounded-[10px] border border-brand-gold/[0.16] bg-white shadow-[0_1px_2px_rgba(16,28,54,0.03),0_12px_30px_-22px_rgba(16,28,54,0.16)]";
const CONTROL =
  "h-11 w-full rounded-lg border border-brand-burgundy/[0.1] bg-white text-[13.5px] text-brand-burgundy transition-colors focus-visible:border-brand-gold/70 focus-visible:outline-none lg:h-[38px]";

/**
 * Admin — the Orders page body: the summary cards and the list (search/status
 * filter bar, compact table from `xl`, card list below it, and the empty
 * states). Every row is a real order passed in from the page's query, and
 * there is deliberately no pagination — the page reads the newest orders only
 * and the footer says so when there are more.
 *
 * Each row's status badge is a button: it opens a small menu of the statuses
 * the EXISTING order workflow allows next (`getAllowedNextStatuses` — the same
 * rules `updateOrderStatusAction` enforces on the server) and saves through
 * that protected action. The badge and the cards update at once; a refresh then
 * brings the server's real figures, and a failed save rolls everything back.
 * The search / status filter above is a plain GET form and is untouched.
 */
export function AdminOrdersList({
  counts,
  orders,
  fetchedCount,
  totalCount,
  query,
  status,
}: {
  /** The summary figures (Firestore aggregation over every order). */
  counts: OrderSummaryCounts;
  /** Orders to show — already filtered. */
  orders: AdminOrderRow[];
  /** How many orders the page loaded before filtering. */
  fetchedCount: number;
  /** Every order in the store (aggregate count). */
  totalCount: number;
  query: string;
  status: OrderStatus | null;
}) {
  const tRaw = useTranslations("AdminOrders");
  const t = tRaw as unknown as OrdersTranslate;
  const locale = useLocale() === "ar" ? "ar" : "en";
  const router = useRouter();

  // Optimistic statuses while a change is saving (and until the refresh lands). A fresh `orders`
  // prop from the server is the source of truth again, except for an order still being saved.
  const [overrides, setOverrides] = useState<Record<string, OrderStatus>>({});
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ order: AdminOrderRow; next: OrderStatus } | null>(null);
  const inFlight = useRef(new Set<string>());
  const [source, setSource] = useState(orders);
  if (source !== orders) {
    setSource(orders);
    setOverrides((current) =>
      Object.fromEntries(Object.entries(current).filter(([id]) => pendingIds.has(id))),
    );
  }

  const rows = useMemo(
    () =>
      orders.map((order) =>
        overrides[order.id] ? { ...order, status: overrides[order.id]! } : order,
      ),
    [orders, overrides],
  );
  // The cards: the server's counts, moved by each optimistic change (from the status the server last
  // reported to the one shown).
  const shownCounts = useMemo(
    () =>
      orders.reduce(
        (acc, order) =>
          overrides[order.id]
            ? applyOrderStatusToCounts(acc, order.status, overrides[order.id]!)
            : acc,
        counts,
      ),
    [orders, overrides, counts],
  );

  const stats = [
    { key: "total", value: shownCounts.total, icon: ShoppingBag, tone: "gold" },
    { key: "pending", value: shownCounts.pending, icon: Clock, tone: "gold" },
    { key: "inProgress", value: shownCounts.inProgress, icon: Truck, tone: "blue" },
    { key: "delivered", value: shownCounts.delivered, icon: CircleCheck, tone: "green" },
  ] as const;

  /** A status was chosen in a row's menu. Final statuses (no further change possible) ask first. */
  function choose(order: AdminOrderRow, next: OrderStatus) {
    if (inFlight.current.has(order.id)) return;
    // The menu only offers valid transitions; this guards the handler as well. The server re-checks anyway.
    if (!isValidOrderStatusTransition(order.status, next)) return;
    if (getAllowedNextStatuses(next).length === 0) {
      setConfirm({ order, next });
      return;
    }
    void apply(order, next);
  }

  async function apply(order: AdminOrderRow, next: OrderStatus) {
    if (inFlight.current.has(order.id)) return; // no double submits
    inFlight.current.add(order.id);
    setNotice(null);
    setOverrides((current) => ({ ...current, [order.id]: next }));
    setPendingIds((current) => new Set(current).add(order.id));

    const rollback = (message: string) => {
      setOverrides(({ [order.id]: _dropped, ...rest }) => rest);
      setNotice(message);
    };
    try {
      // The existing protected action: admin-only, and the server re-checks the transition against the
      // order's CURRENT status inside a transaction (cancelling also restocks).
      const result = await updateOrderStatusAction({ orderId: order.id, status: next });
      if (result.ok) {
        router.refresh();
      } else {
        rollback(result.error.message);
        // The order moved or vanished since this page loaded — show its real state.
        if (result.error.code === "INVALID_TRANSITION" || result.error.code === "NOT_FOUND")
          router.refresh();
      }
    } catch {
      rollback(t("statusMenu.failed"));
    } finally {
      inFlight.current.delete(order.id);
      setPendingIds((current) => {
        const nextIds = new Set(current);
        nextIds.delete(order.id);
        return nextIds;
      });
    }
  }

  const statusControl = (order: AdminOrderRow, align: "start" | "end") => (
    <OrderStatusMenu
      status={order.status}
      label={t(`status.${order.status}`)}
      options={getAllowedNextStatuses(order.status).map((value) => ({
        status: value,
        label: t(`status.${value}`),
      }))}
      pending={pendingIds.has(order.id)}
      changeLabel={t("statusMenu.change")}
      menuLabel={t("statusMenu.menu")}
      currentLabel={t("statusMenu.current")}
      finalLabel={t("statusMenu.final")}
      align={align}
      onSelect={(next) => choose(order, next)}
    />
  );

  const hasFilters = query.trim() !== "" || status !== null;
  const intlLocale = locale === "ar" ? "ar-u-nu-latn" : "en-US";
  const dateFormat = new Intl.DateTimeFormat(intlLocale, {
    dateStyle: "medium",
    timeZone: "Asia/Hebron",
  });
  const timeFormat = new Intl.DateTimeFormat(intlLocale, {
    timeStyle: "short",
    timeZone: "Asia/Hebron",
  });
  const money = (minor: number) => formatCurrency(minor, locale === "ar" ? "ar" : "en-US");
  const total = Math.max(totalCount, fetchedCount);

  const footer = !hasFilters
    ? total > fetchedCount
      ? t("footer.latest", { shown: orders.length, total })
      : t("footer.count", { shown: orders.length, total })
    : total > fetchedCount
      ? t("footer.matchingLatest", { shown: orders.length, fetched: fetchedCount })
      : t("footer.count", { shown: orders.length, total });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-[13px] xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard
            key={stat.key}
            label={t(`stats.${stat.key}`)}
            value={stat.value}
            icon={stat.icon}
            tone={stat.tone}
            note={stat.key === "inProgress" ? t("stats.inProgressNote") : undefined}
          />
        ))}
      </div>

      {notice ? (
        <p
          role="alert"
          className="rounded-lg bg-[#fbeeec] px-3.5 py-2.5 text-[13px] text-[#9a3f36]"
        >
          {notice}
        </p>
      ) : null}

      <div className="flex flex-col gap-3.5">
        {/* ── Search / filter bar (a plain GET form: the page filters on the server) ── */}
        <form
          method="get"
          role="search"
          aria-label={t("filters.label")}
          className={cn(
            SURFACE,
            "flex flex-wrap items-center gap-2.5 p-3 lg:gap-3 lg:px-3.5 lg:py-3",
          )}
        >
          <label className="relative w-full lg:w-auto lg:min-w-[220px] lg:flex-1">
            <span className="sr-only">{t("filters.searchLabel")}</span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 stroke-[1.7] text-text-secondary"
            />
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder={t("filters.search")}
              className={cn(CONTROL, "bg-brand-ivory pe-3 ps-10 placeholder:text-text-secondary")}
            />
          </label>
          <label className="relative min-w-0 flex-1 basis-[calc(50%-0.625rem)] sm:basis-0 lg:w-[190px] lg:flex-none">
            <span className="sr-only">{t("filters.status")}</span>
            <select
              name="status"
              defaultValue={status ?? ""}
              className={cn(CONTROL, "cursor-pointer appearance-none pe-9 ps-3.5")}
            >
              <option value="">{t("filters.allStatuses")}</option>
              {ORDER_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {t(`status.${value}`)}
                </option>
              ))}
            </select>
            <ChevronDown
              aria-hidden="true"
              className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 stroke-[1.7] text-brand-burgundy"
            />
          </label>
          <button
            type="submit"
            className="inline-flex h-11 min-w-[112px] flex-1 items-center justify-center gap-2 rounded-lg border border-brand-gold/50 bg-white px-4 text-[13.5px] font-medium text-brand-burgundy transition-colors hover:border-brand-gold hover:bg-brand-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50 sm:flex-none lg:h-[38px]"
          >
            <SlidersHorizontal aria-hidden="true" className="size-[15px] stroke-[1.7]" />
            {t("filters.apply")}
          </button>
          {hasFilters ? (
            <Link
              href="/admin/orders"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg px-3 text-[13.5px] text-text-secondary transition-colors hover:bg-brand-cream hover:text-brand-burgundy lg:h-[38px]"
            >
              <RotateCcw aria-hidden="true" className="size-[15px] stroke-[1.7]" />
              {t("filters.clear")}
            </Link>
          ) : null}
        </form>

        {rows.length === 0 ? (
          <EmptyState t={t} filtered={hasFilters} />
        ) : (
          <>
            {/* ── Desktop table (xl+) ─────────────────────────────────────── */}
            <div className={cn(SURFACE, "hidden xl:block")}>
              <table className="w-full table-fixed border-collapse text-start">
                <colgroup>
                  <col className="w-[19%]" />
                  <col />
                  <col className="w-[17%]" />
                  <col className="w-[13%]" />
                  <col className="w-[15%]" />
                  <col className="w-[84px]" />
                </colgroup>
                <thead>
                  <tr className="h-[46px] border-b border-brand-burgundy/[0.07] bg-brand-cream/60 text-[13px] text-brand-burgundy">
                    {(["order", "customer", "date", "total", "status"] as const).map(
                      (key, index) => (
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
                      ),
                    )}
                    <th scope="col" className="whitespace-nowrap px-3 pe-5 text-end font-medium">
                      {t("columns.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((order) => (
                    <tr
                      key={order.id}
                      data-testid="admin-row"
                      className="h-[64px] border-b border-brand-burgundy/[0.06] last:border-b-0 hover:bg-brand-ivory/70"
                    >
                      <td className="px-3 ps-5">
                        <Link
                          id={`order-number-${order.id}`}
                          href={`/admin/orders/${order.id}`}
                          dir="ltr"
                          className="inline-block max-w-full truncate text-[13.5px] font-medium lining-nums tabular-nums text-brand-burgundy hover:underline rtl:text-right"
                        >
                          {order.orderNumber}
                        </Link>
                      </td>
                      <td className="px-3">
                        <Customer order={order} t={t} />
                      </td>
                      <td className="px-3">
                        <DateTime order={order} dateFormat={dateFormat} timeFormat={timeFormat} />
                      </td>
                      <td
                        dir="ltr"
                        className="px-3 text-start text-[14px] lining-nums tabular-nums text-brand-burgundy rtl:text-right [font-family:var(--font-playfair),serif]"
                      >
                        {money(order.total)}
                      </td>
                      <td className="px-3">{statusControl(order, "start")}</td>
                      <td className="px-3 pe-5">
                        <div className="flex justify-end">
                          <ViewLink order={order} t={t} describedBy={`order-number-${order.id}`} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Card list (below xl) ───────────────────────────────────── */}
            <ul className="flex flex-col gap-3 xl:hidden">
              {rows.map((order) => (
                <li
                  key={order.id}
                  data-testid="admin-row"
                  className="rounded-[10px] border border-brand-gold/[0.16] bg-white p-3.5 shadow-[0_1px_2px_rgba(16,28,54,0.03)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        id={`order-card-number-${order.id}`}
                        href={`/admin/orders/${order.id}`}
                        dir="ltr"
                        className="block max-w-full truncate text-[14.5px] font-medium lining-nums tabular-nums text-brand-burgundy hover:underline rtl:text-right"
                      >
                        {order.orderNumber}
                      </Link>
                      <div className="mt-1">
                        <DateTime
                          order={order}
                          dateFormat={dateFormat}
                          timeFormat={timeFormat}
                          inline
                        />
                      </div>
                    </div>
                    {statusControl(order, "end")}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-brand-burgundy/[0.06] pt-3">
                    <div className="min-w-0 flex-1">
                      <Customer order={order} t={t} />
                    </div>
                    <span
                      dir="ltr"
                      className="shrink-0 text-[15px] lining-nums tabular-nums text-brand-burgundy rtl:text-right [font-family:var(--font-playfair),serif]"
                    >
                      {money(order.total)}
                    </span>
                    <ViewLink order={order} t={t} describedBy={`order-card-number-${order.id}`} />
                  </div>
                </li>
              ))}
            </ul>

            <p className="px-1 text-[13px] text-text-secondary lining-nums" aria-live="polite">
              {footer}
            </p>
          </>
        )}
      </div>

      {confirm ? (
        <ConfirmDialog
          titleId="order-status-confirm-title"
          title={t(`statusMenu.confirm.${confirm.next}.title`)}
          description={t(`statusMenu.confirm.${confirm.next}.body`)}
          cancelLabel={t("statusMenu.back")}
          confirmLabel={t(`statusMenu.confirm.${confirm.next}.action`)}
          tone={confirm.next === "CANCELLED" ? "danger" : "default"}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const { order, next } = confirm;
            setConfirm(null);
            void apply(order, next);
          }}
        />
      ) : null}
    </div>
  );
}

function Customer({ order, t }: { order: AdminOrderRow; t: OrdersTranslate }) {
  const initial = Array.from(order.customerName.trim())[0]?.toUpperCase() ?? "?";
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden="true"
        className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-cream text-[14px] text-brand-burgundy [font-family:var(--font-playfair),serif]"
      >
        {initial}
      </span>
      <div className="min-w-0">
        <p className="flex min-w-0 items-center gap-2 text-[14px] leading-tight text-brand-burgundy">
          <span className="truncate">{order.customerName}</span>
          {order.isGuest ? (
            <span className="shrink-0 rounded-md bg-brand-cream px-1.5 py-0.5 text-[11px] leading-none text-text-secondary">
              {t("guest")}
            </span>
          ) : null}
        </p>
        <p dir="ltr" className="mt-0.5 truncate text-[12.5px] text-text-secondary rtl:text-right">
          {order.customerEmail}
        </p>
      </div>
    </div>
  );
}

function DateTime({
  order,
  dateFormat,
  timeFormat,
  inline = false,
}: {
  order: AdminOrderRow;
  dateFormat: Intl.DateTimeFormat;
  timeFormat: Intl.DateTimeFormat;
  inline?: boolean;
}) {
  const date = new Date(order.createdAt);
  return inline ? (
    <p className="text-[12.5px] lining-nums text-text-secondary">
      {dateFormat.format(date)} · {timeFormat.format(date)}
    </p>
  ) : (
    <>
      <p className="text-[13.5px] lining-nums text-brand-burgundy">{dateFormat.format(date)}</p>
      <p className="mt-0.5 text-[12.5px] lining-nums text-text-secondary">
        {timeFormat.format(date)}
      </p>
    </>
  );
}

/**
 * The row's view control. Named just "View" (described by the order number)
 * so the order-number link stays the one control carrying the order's name.
 */
function ViewLink({
  order,
  t,
  describedBy,
}: {
  order: AdminOrderRow;
  t: OrdersTranslate;
  describedBy: string;
}) {
  return (
    <Link
      href={`/admin/orders/${order.id}`}
      aria-label={t("view")}
      aria-describedby={describedBy}
      title={t("viewOrder", { orderNumber: order.orderNumber })}
      className="grid size-10 shrink-0 place-items-center rounded-lg border border-brand-burgundy/[0.1] bg-white text-brand-burgundy transition-colors hover:border-brand-gold/50 hover:bg-brand-ivory xl:size-9"
    >
      <Eye aria-hidden="true" className="size-[16px] stroke-[1.7]" />
    </Link>
  );
}

function EmptyState({ t, filtered }: { t: OrdersTranslate; filtered: boolean }) {
  return (
    <div
      data-testid="orders-empty"
      className={cn(
        SURFACE,
        "flex flex-col items-center gap-5 px-6 py-10 text-center sm:flex-row sm:justify-center sm:gap-8 sm:text-start",
      )}
    >
      <span
        aria-hidden="true"
        className="grid size-[88px] shrink-0 place-items-center rounded-full bg-brand-gold/[0.13]"
      >
        <ShoppingBag className="size-9 stroke-[1.3] text-brand-gold-ink" />
      </span>
      <div className="flex max-w-[420px] flex-col items-center gap-1.5 sm:items-start">
        <h2 className="font-display text-[20px] leading-tight text-brand-burgundy">
          {t("empty.title")}
        </h2>
        <p className="text-[14px] leading-relaxed text-text-secondary">
          {filtered ? t("empty.filtered") : t("empty.none")}
        </p>
        {filtered ? (
          <Link
            href="/admin/orders"
            className="mt-2 inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-brand-gold/50 bg-white px-5 text-[13.5px] font-medium text-brand-burgundy transition-colors hover:border-brand-gold hover:bg-brand-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50"
          >
            {t("filters.clear")}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
