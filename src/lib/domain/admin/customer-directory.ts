/**
 * Pure logic behind the admin Customers list: search, the orders / joined
 * filters, the summary figures, pagination and the month boundary. No
 * server-only imports, so it can be unit-tested and shared. Every row here is
 * already a CUSTOMER-role account — that filtering happens in
 * `customer.service.ts`, never in the UI.
 */

/** The store's calendar (matches the dashboard and Orders pages). */
export const STORE_TIME_ZONE = "Asia/Hebron";
export const CUSTOMER_PAGE_SIZE = 20;

export type CustomerRow = {
  uid: string;
  name: string;
  email: string;
  phone: string | null;
  /** Account creation time, epoch milliseconds. */
  createdAt: number;
  /** Every order this customer has placed (any status), as on their detail page. */
  orderCount: number;
};

export type CustomerOrdersFilter = "all" | "withOrders" | "noOrders";
export type CustomerJoinedFilter = "all" | "thisMonth" | "last30";

export type CustomerFilters = {
  query: string;
  orders: CustomerOrdersFilter;
  joined: CustomerJoinedFilter;
};

export type CustomerStats = {
  total: number;
  newThisMonth: number;
  /** `null` when it cannot be counted correctly (more customers than were loaded). */
  withOrders: number | null;
  noOrders: number | null;
};

export function parseOrdersFilter(value: string | undefined): CustomerOrdersFilter {
  return value === "withOrders" || value === "noOrders" ? value : "all";
}

export function parseJoinedFilter(value: string | undefined): CustomerJoinedFilter {
  return value === "thisMonth" || value === "last30" ? value : "all";
}

export function parsePage(value: string | undefined): number {
  const page = Number.parseInt(value ?? "", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function zoneOffsetMs(instantMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(new Date(instantMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const local = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return local - Math.floor(instantMs / 1000) * 1000;
}

/** The instant the current calendar month began in `timeZone` (epoch ms). */
export function startOfMonthInZone(now: Date, timeZone: string = STORE_TIME_ZONE): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const naive = Date.UTC(year, month - 1, 1);
  // Two passes so a daylight-saving change right at the boundary still lands on local midnight.
  const first = naive - zoneOffsetMs(naive, timeZone);
  return naive - zoneOffsetMs(first, timeZone);
}

export function computeCustomerStats(rows: CustomerRow[], monthStartMs: number): CustomerStats {
  const withOrders = rows.filter((row) => row.orderCount > 0).length;
  return {
    total: rows.length,
    newThisMonth: rows.filter((row) => row.createdAt >= monthStartMs).length,
    withOrders,
    noOrders: rows.length - withOrders,
  };
}

const digitsOf = (value: string) => value.replace(/\D/g, "");

/**
 * Case-insensitive search over the fields a customer actually has — name,
 * email and phone (phone also matches by digits, so "059 123" finds
 * "+970 59 123 4567") — combined with the orders and joined filters.
 */
export function filterCustomers(
  rows: CustomerRow[],
  filters: CustomerFilters,
  { now, monthStartMs }: { now: Date; monthStartMs: number },
): CustomerRow[] {
  const query = filters.query.trim().toLowerCase();
  const queryDigits = digitsOf(query);
  const joinedFrom =
    filters.joined === "thisMonth"
      ? monthStartMs
      : filters.joined === "last30"
        ? now.getTime() - 30 * 24 * 60 * 60 * 1000
        : null;

  return rows.filter((row) => {
    if (filters.orders === "withOrders" && row.orderCount === 0) return false;
    if (filters.orders === "noOrders" && row.orderCount > 0) return false;
    if (joinedFrom !== null && row.createdAt < joinedFrom) return false;
    if (!query) return true;
    if (row.name.toLowerCase().includes(query) || row.email.toLowerCase().includes(query))
      return true;
    if (!row.phone) return false;
    return (
      row.phone.toLowerCase().includes(query) ||
      (queryDigits.length >= 3 && digitsOf(row.phone).includes(queryDigits))
    );
  });
}

export type Paged<T> = {
  items: T[];
  page: number;
  pageCount: number;
  /** 1-based positions of the first and last item on this page (0 when empty). */
  from: number;
  to: number;
  total: number;
};

/** Slices an already-loaded, already-filtered list; an out-of-range page clamps to the last one. */
export function paginate<T>(
  items: T[],
  requestedPage: number,
  pageSize: number = CUSTOMER_PAGE_SIZE,
): Paged<T> {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(Math.max(1, requestedPage), pageCount);
  const start = (page - 1) * pageSize;
  const slice = items.slice(start, start + pageSize);
  return {
    items: slice,
    page,
    pageCount,
    from: slice.length ? start + 1 : 0,
    to: start + slice.length,
    total: items.length,
  };
}

/** Page numbers to show — first, last, and the neighbours of the current page, with `"gap"` between runs. */
export function pageWindow(page: number, pageCount: number): Array<number | "gap"> {
  const wanted = new Set(
    [1, pageCount, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pageCount),
  );
  const sorted = [...wanted].sort((a, b) => a - b);
  const out: Array<number | "gap"> = [];
  sorted.forEach((n, index) => {
    if (index > 0 && n - sorted[index - 1]! > 1) out.push("gap");
    out.push(n);
  });
  return out;
}
