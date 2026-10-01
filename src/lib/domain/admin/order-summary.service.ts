import "server-only";
import { ordersCollection } from "@/lib/firebase/firestore";
import { IN_PROGRESS_STATUSES, type OrderSummaryCounts } from "./order-filters";

export type { OrderSummaryCounts };

/**
 * The Orders page's summary figures, counted by Firestore aggregation
 * (`count()`), so they cover every order — not just the page's newest 100 —
 * without reading a single order document.
 */
export async function getOrderSummaryCounts(): Promise<OrderSummaryCounts> {
  const orders = ordersCollection();
  const count = async (query: { count(): { get(): Promise<{ data(): { count: number } }> } }) =>
    (await query.count().get()).data().count;

  const [total, pending, inProgress, delivered] = await Promise.all([
    count(orders),
    count(orders.where("status", "==", "PENDING")),
    count(orders.where("status", "in", [...IN_PROGRESS_STATUSES])),
    count(orders.where("status", "==", "DELIVERED")),
  ]);
  return { total, pending, inProgress, delivered };
}
