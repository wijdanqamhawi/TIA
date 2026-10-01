import Link from "next/link";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { DirectionalIcon } from "@/components/ui/DirectionalIcon";
import {
  pageWindow,
  type CustomerJoinedFilter,
  type CustomerOrdersFilter,
  type CustomerRow,
  type Paged,
} from "@/lib/domain/admin/customer-directory";

export type CustomersTranslate = (key: string, values?: Record<string, string | number>) => string;

const SURFACE =
  "rounded-[10px] border border-brand-gold/[0.16] bg-white shadow-[0_1px_2px_rgba(16,28,54,0.03),0_12px_30px_-22px_rgba(16,28,54,0.16)]";
const CONTROL =
  "h-11 w-full rounded-lg border border-brand-burgundy/[0.1] bg-white text-[13.5px] text-brand-burgundy transition-colors focus-visible:border-brand-gold/70 focus-visible:outline-none lg:h-[38px]";
const OUTLINE_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-brand-gold/50 bg-white text-[13.5px] font-medium text-brand-burgundy transition-colors hover:border-brand-gold hover:bg-brand-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50";

/**
 * Admin — the Customers list: filter bar, compact table from `xl`, a card
 * list below it, pager and empty states. Purely presentational — every row
 * is a real CUSTOMER account handed in by the page, already filtered and
 * paged on the server.
 */
export function AdminCustomersList({
  t,
  locale,
  paged,
  query,
  orders,
  joined,
  truncatedTotal,
  loadedCount,
}: {
  t: CustomersTranslate;
  locale: "en" | "ar";
  paged: Paged<CustomerRow>;
  query: string;
  orders: CustomerOrdersFilter;
  joined: CustomerJoinedFilter;
  /** Set when more customers exist than the list loads. */
  truncatedTotal: number | null;
  loadedCount: number;
}) {
  const hasFilters = query.trim() !== "" || orders !== "all" || joined !== "all";
  const dateFormat = new Intl.DateTimeFormat(locale === "ar" ? "ar-u-nu-latn" : "en-US", {
    dateStyle: "medium",
    timeZone: "Asia/Hebron",
  });

  function pageHref(page: number): string {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (orders !== "all") params.set("orders", orders);
    if (joined !== "all") params.set("joined", joined);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return qs ? `/admin/customers?${qs}` : "/admin/customers";
  }

  return (
    <div className="flex flex-col gap-3.5">
      {/* ── Filter bar (a plain GET form: the page filters on the server) ── */}
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
        <FilterSelect name="orders" label={t("filters.orders")} value={orders}>
          <option value="all">{t("filters.allCustomers")}</option>
          <option value="withOrders">{t("filters.withOrders")}</option>
          <option value="noOrders">{t("filters.noOrders")}</option>
        </FilterSelect>
        <FilterSelect name="joined" label={t("filters.joined")} value={joined}>
          <option value="all">{t("filters.allTime")}</option>
          <option value="thisMonth">{t("filters.thisMonth")}</option>
          <option value="last30">{t("filters.last30")}</option>
        </FilterSelect>
        <button
          type="submit"
          className={cn(OUTLINE_BUTTON, "h-11 min-w-[112px] flex-1 px-4 sm:flex-none lg:h-[38px]")}
        >
          <SlidersHorizontal aria-hidden="true" className="size-[15px] stroke-[1.7]" />
          {t("filters.apply")}
        </button>
        {hasFilters ? (
          <Link
            href="/admin/customers"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg px-3 text-[13.5px] text-text-secondary transition-colors hover:bg-brand-cream hover:text-brand-burgundy lg:h-[38px]"
          >
            <RotateCcw aria-hidden="true" className="size-[15px] stroke-[1.7]" />
            {t("filters.clear")}
          </Link>
        ) : null}
      </form>

      {paged.total === 0 ? (
        <EmptyState t={t} filtered={hasFilters} />
      ) : (
        <>
          {/* ── Desktop table (xl+) ─────────────────────────────────────── */}
          <div className={cn(SURFACE, "hidden xl:block")}>
            <table className="w-full table-fixed border-collapse text-start">
              <colgroup>
                <col className="w-[5%]" />
                <col className="w-[21%]" />
                <col />
                <col className="w-[15%]" />
                <col className="w-[11.5%]" />
                <col className="w-[8%]" />
                <col className="w-[12.5%]" />
                <col className="w-[76px]" />
              </colgroup>
              <thead>
                <tr className="h-[46px] border-b border-brand-burgundy/[0.07] bg-brand-cream/60 text-[13px] text-brand-burgundy">
                  {(
                    ["number", "customer", "email", "phone", "joined", "orders", "status"] as const
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
                {paged.items.map((customer, index) => (
                  <tr
                    key={customer.uid}
                    data-testid="admin-row"
                    className="h-[62px] border-b border-brand-burgundy/[0.06] last:border-b-0 hover:bg-brand-ivory/70"
                  >
                    <td className="px-3 ps-5 text-[13px] lining-nums tabular-nums text-text-secondary">
                      {paged.from + index}
                    </td>
                    <td className="px-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar name={customer.name} />
                        <Link
                          id={`customer-name-${customer.uid}`}
                          href={`/admin/customers/${customer.uid}`}
                          className="min-w-0 truncate text-[14px] font-medium text-brand-burgundy hover:underline"
                        >
                          {customer.name}
                        </Link>
                      </div>
                    </td>
                    <td
                      dir="ltr"
                      className="truncate px-3 text-start text-[13px] text-text-secondary rtl:text-right"
                    >
                      {customer.email}
                    </td>
                    <td className="px-3 text-[13px] text-brand-burgundy">
                      <Phone phone={customer.phone} />
                    </td>
                    <td className="px-3 text-[13px] lining-nums text-brand-burgundy">
                      {dateFormat.format(new Date(customer.createdAt))}
                    </td>
                    <td className="px-3 text-[14px] lining-nums tabular-nums text-brand-burgundy">
                      {customer.orderCount}
                    </td>
                    <td className="px-3">
                      <StatusPill hasOrders={customer.orderCount > 0} t={t} />
                    </td>
                    <td className="px-3 pe-5">
                      <div className="flex justify-end">
                        <ViewLink
                          customer={customer}
                          t={t}
                          describedBy={`customer-name-${customer.uid}`}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Card list (below xl) ───────────────────────────────────── */}
          <ul className="flex flex-col gap-3 xl:hidden">
            {paged.items.map((customer) => (
              <li
                key={customer.uid}
                data-testid="admin-row"
                className="rounded-[10px] border border-brand-gold/[0.16] bg-white p-3.5 shadow-[0_1px_2px_rgba(16,28,54,0.03)]"
              >
                <div className="flex items-start gap-3">
                  <Avatar name={customer.name} />
                  <div className="min-w-0 flex-1">
                    <Link
                      id={`customer-card-name-${customer.uid}`}
                      href={`/admin/customers/${customer.uid}`}
                      className="block max-w-full truncate text-[15px] font-medium text-brand-burgundy hover:underline"
                    >
                      {customer.name}
                    </Link>
                    <p
                      dir="ltr"
                      className="mt-0.5 truncate text-[12.5px] text-text-secondary rtl:text-right"
                    >
                      {customer.email}
                    </p>
                  </div>
                  <ViewLink
                    customer={customer}
                    t={t}
                    describedBy={`customer-card-name-${customer.uid}`}
                  />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 border-t border-brand-burgundy/[0.06] pt-3 text-[12px] text-text-secondary sm:grid-cols-4">
                  <div className="flex min-w-0 flex-col items-start gap-1">
                    <dt>{t("columns.phone")}</dt>
                    <dd className="max-w-full truncate text-[13px] text-brand-burgundy">
                      <Phone phone={customer.phone} />
                    </dd>
                  </div>
                  <div className="flex flex-col items-start gap-1">
                    <dt>{t("columns.joined")}</dt>
                    <dd className="text-[13px] lining-nums text-brand-burgundy">
                      {dateFormat.format(new Date(customer.createdAt))}
                    </dd>
                  </div>
                  <div className="flex flex-col items-start gap-1">
                    <dt>{t("columns.orders")}</dt>
                    <dd className="text-[13px] lining-nums tabular-nums text-brand-burgundy">
                      {customer.orderCount}
                    </dd>
                  </div>
                  <div className="flex flex-col items-start gap-1">
                    <dt>{t("columns.status")}</dt>
                    <dd>
                      <StatusPill hasOrders={customer.orderCount > 0} t={t} />
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>

          {/* ── Footer: count + pager ──────────────────────────────────── */}
          <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[13px] text-text-secondary lining-nums" aria-live="polite">
              {t("footer.showing", { from: paged.from, to: paged.to, total: paged.total })}
              {truncatedTotal !== null ? (
                <span className="block text-[12px]">
                  {t("footer.truncated", { loaded: loadedCount, total: truncatedTotal })}
                </span>
              ) : null}
            </p>
            {paged.pageCount > 1 ? <Pager t={t} paged={paged} pageHref={pageHref} /> : null}
          </div>
        </>
      )}
    </div>
  );
}

function FilterSelect({
  name,
  label,
  value,
  children,
}: {
  name: string;
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <label className="relative min-w-0 flex-1 basis-[calc(50%-0.625rem)] sm:basis-0 lg:w-[172px] lg:flex-none">
      <span className="sr-only">{label}</span>
      <select
        name={name}
        defaultValue={value}
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

function Avatar({ name }: { name: string }) {
  const initial = Array.from(name.trim())[0]?.toUpperCase() ?? "?";
  return (
    <span
      aria-hidden="true"
      className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-cream text-[14px] text-brand-burgundy [font-family:var(--font-playfair),serif]"
    >
      {initial}
    </span>
  );
}

/** A missing phone renders as an em dash, never as "null" or an empty cell. */
function Phone({ phone }: { phone: string | null }) {
  return phone ? (
    <span dir="ltr" className="inline-block max-w-full truncate lining-nums rtl:text-right">
      {phone}
    </span>
  ) : (
    <span className="text-text-secondary/80">—</span>
  );
}

/** A label derived from the order count — not a stored account status. */
function StatusPill({ hasOrders, t }: { hasOrders: boolean; t: CustomersTranslate }) {
  return (
    <span
      data-status={hasOrders ? "with-orders" : "no-orders"}
      className={cn(
        "inline-flex h-[26px] items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[12.5px] leading-none",
        hasOrders ? "bg-[#e6f0e9] text-[#2f6844]" : "bg-brand-gold/[0.18] text-brand-gold-ink",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          hasOrders ? "bg-[#3f7a55]" : "bg-brand-gold",
        )}
      />
      {hasOrders ? t("status.withOrders") : t("status.noOrders")}
    </span>
  );
}

/**
 * The row's view control — named just "View" (described by the customer's
 * name) so the name link stays the one control carrying the customer's name.
 */
function ViewLink({
  customer,
  t,
  describedBy,
}: {
  customer: CustomerRow;
  t: CustomersTranslate;
  describedBy: string;
}) {
  return (
    <Link
      href={`/admin/customers/${customer.uid}`}
      aria-label={t("view")}
      aria-describedby={describedBy}
      title={t("viewCustomer", { name: customer.name })}
      className="grid size-10 shrink-0 place-items-center rounded-lg border border-brand-burgundy/[0.1] bg-white text-brand-burgundy transition-colors hover:border-brand-gold/50 hover:bg-brand-ivory xl:size-9"
    >
      <Eye aria-hidden="true" className="size-[16px] stroke-[1.7]" />
    </Link>
  );
}

function Pager({
  t,
  paged,
  pageHref,
}: {
  t: CustomersTranslate;
  paged: Paged<CustomerRow>;
  pageHref: (page: number) => string;
}) {
  const step =
    "grid size-9 place-items-center rounded-lg text-[13.5px] lining-nums text-brand-burgundy transition-colors";
  return (
    <nav aria-label={t("pagination.label")} className="flex items-center gap-1">
      {paged.page > 1 ? (
        <Link
          href={pageHref(paged.page - 1)}
          aria-label={t("pagination.previous")}
          className={cn(step, "hover:bg-brand-cream")}
        >
          <DirectionalIcon icon={ChevronLeft} aria-hidden="true" className="size-4 stroke-[1.8]" />
        </Link>
      ) : (
        <span aria-hidden="true" className={cn(step, "opacity-35")}>
          <DirectionalIcon icon={ChevronLeft} className="size-4 stroke-[1.8]" />
        </span>
      )}
      {pageWindow(paged.page, paged.pageCount).map((entry, index) =>
        entry === "gap" ? (
          <span key={`gap-${index}`} aria-hidden="true" className={cn(step, "text-text-secondary")}>
            …
          </span>
        ) : entry === paged.page ? (
          <span
            key={entry}
            aria-current="page"
            aria-label={t("pagination.page", { page: entry })}
            className={cn(step, "bg-brand-gold/[0.2] font-medium")}
          >
            {entry}
          </span>
        ) : (
          <Link
            key={entry}
            href={pageHref(entry)}
            aria-label={t("pagination.page", { page: entry })}
            className={cn(step, "hover:bg-brand-cream")}
          >
            {entry}
          </Link>
        ),
      )}
      {paged.page < paged.pageCount ? (
        <Link
          href={pageHref(paged.page + 1)}
          aria-label={t("pagination.next")}
          className={cn(step, "hover:bg-brand-cream")}
        >
          <DirectionalIcon icon={ChevronRight} aria-hidden="true" className="size-4 stroke-[1.8]" />
        </Link>
      ) : (
        <span aria-hidden="true" className={cn(step, "opacity-35")}>
          <DirectionalIcon icon={ChevronRight} className="size-4 stroke-[1.8]" />
        </span>
      )}
    </nav>
  );
}

function EmptyState({ t, filtered }: { t: CustomersTranslate; filtered: boolean }) {
  return (
    <div
      data-testid="customers-empty"
      className={cn(
        SURFACE,
        "flex flex-col items-center gap-5 px-6 py-10 text-center sm:flex-row sm:justify-center sm:gap-8 sm:text-start",
      )}
    >
      <span
        aria-hidden="true"
        className="grid size-[88px] shrink-0 place-items-center rounded-full bg-brand-gold/[0.13]"
      >
        <Users className="size-9 stroke-[1.3] text-brand-gold-ink" />
      </span>
      <div className="flex max-w-[420px] flex-col items-center gap-1.5 sm:items-start">
        <h2 className="font-display text-[20px] leading-tight text-brand-burgundy">
          {t("empty.title")}
        </h2>
        <p className="text-[14px] leading-relaxed text-text-secondary">
          {filtered ? t("empty.filtered") : t("empty.none")}
        </p>
        {filtered ? (
          <Link href="/admin/customers" className={cn(OUTLINE_BUTTON, "mt-2 h-10 px-5")}>
            {t("filters.clear")}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
