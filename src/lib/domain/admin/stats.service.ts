import "server-only";
import type { Transaction } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { statsSummaryDoc } from "@/lib/firebase/firestore";

export type PendingStatsUpdate = {
  /** Call during the transaction's write phase, after every read is done. */
  commit: () => void;
};

/**
 * Reads `stats/summary` during the transaction's **read phase** and
 * returns a `commit()` closure for the **write phase** (same read/write
 * split as `reserveOrderNumber` — Firestore requires every read before
 * any write in one transaction). `totalDelta`/`orderDelta` are `+order.
 * total`/`+1` on order creation, `-order.total`/`-1` on cancellation
 * (Phase 10) — this single denormalized document lets the dashboard read
 * total sales/orders in one document read regardless of how many orders
 * the store has accumulated (research.md §17b).
 */
export async function reserveStatsUpdate(
  transaction: Transaction,
  totalDelta: number,
  orderDelta: 1 | -1,
): Promise<PendingStatsUpdate> {
  const ref = statsSummaryDoc();
  const snapshot = await transaction.get(ref);

  return {
    commit: () => {
      if (snapshot.exists) {
        transaction.update(ref, {
          totalSales: FieldValue.increment(totalDelta),
          totalOrders: FieldValue.increment(orderDelta),
        });
      } else {
        transaction.set(ref, {
          id: ref.id,
          totalSales: Math.max(totalDelta, 0),
          totalOrders: Math.max(orderDelta, 0),
        });
      }
    },
  };
}
