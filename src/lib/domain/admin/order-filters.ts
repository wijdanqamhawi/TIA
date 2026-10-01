import { ORDER_STATUSES, type OrderStatus } from "@/types/order";

/** The statuses between "placed" and "done": confirmed, being prepared, or on their way. */
export const IN_PROGRESS_STATUSES = [
  "CONFIRMED",
  "PREPARING",
  "SHIPPED",
] as const satisfies readonly OrderStatus[];

export type AdminOrderFilters = { query: string; status: OrderStatus | null };

type FilterableOrder = {
  orderNumber: string;
  customerSnapshot: { fullName: string };
  status: OrderStatus;
};

/** A `?status=` value that is one of the real order statuses, otherwise `null`. */
export function parseOrderStatus(value: string | undefined): OrderStatus | null {
  return value && (ORDER_STATUSES as readonly string[]).includes(value)
    ? (value as OrderStatus)
    : null;
}

/**
 * The Orders list's search + status filter: a case-insensitive match on the
 * order number or the customer's name, and an exact status. Unchanged
 * behaviour from the original page, kept pure so it can be tested directly.
 */
export function filterAdminOrders<T extends FilterableOrder>(
  orders: T[],
  filters: AdminOrderFilters,
): T[] {
  const query = filters.query.trim().toLowerCase();
  return orders.filter((order) => {
    if (filters.status && order.status !== filters.status) return false;
    if (!query) return true;
    return (
      order.orderNumber.toLowerCase().includes(query) ||
      order.customerSnapshot.fullName.toLowerCase().includes(query)
    );
  });
}

export type OrderSummaryCounts = {
  /** Every order, including cancelled ones. */
  total: number;
  pending: number;
  /** Confirmed + preparing + shipped. */
  inProgress: number;
  delivered: number;
};

const isInProgress = (status: OrderStatus) =>
  (IN_PROGRESS_STATUSES as readonly OrderStatus[]).includes(status);

/**
 * The summary figures after ONE order moves `from` → `to`, for the instant the admin changes a status
 * from the list (the server's aggregate counts replace this on the refresh that follows). The total
 * never moves; each of the other figures is a pure function of which bucket the order leaves and enters.
 */
export function applyOrderStatusToCounts(
  counts: OrderSummaryCounts,
  from: OrderStatus,
  to: OrderStatus,
): OrderSummaryCounts {
  if (from === to) return counts;
  const delta = (bucket: (status: OrderStatus) => boolean) =>
    Number(bucket(to)) - Number(bucket(from));
  return {
    total: counts.total,
    pending: counts.pending + delta((status) => status === "PENDING"),
    inProgress: counts.inProgress + delta(isInProgress),
    delivered: counts.delivered + delta((status) => status === "DELIVERED"),
  };
}
