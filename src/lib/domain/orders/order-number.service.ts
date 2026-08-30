import "server-only";
import type { Transaction } from "firebase-admin/firestore";
import { orderCounterDoc } from "@/lib/firebase/firestore";

function formatDateKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

export type PendingOrderNumber = {
  orderNumber: string;
  /** Call during the transaction's write phase, after every read is done. */
  commit: () => void;
};

/**
 * Reserves the next human-readable order number `ELR-YYYYMMDD-NNNN`
 * (research.md §4): reads the per-day `counters/order-{dateKey}` document
 * during the transaction's **read phase** and returns a `commit()`
 * closure to invoke during the **write phase** — Firestore requires every
 * transaction read to happen before any write, so the read and the write
 * this needs cannot be done in one step when other reads (products,
 * delivery location, …) must also happen first. Two concurrent checkouts
 * can never receive the same sequence value: Firestore serializes
 * transactions that read/write the same counter document.
 */
export async function reserveOrderNumber(transaction: Transaction, now: Date = new Date()): Promise<PendingOrderNumber> {
  const dateKey = formatDateKey(now);
  const ref = orderCounterDoc(dateKey);
  const snapshot = await transaction.get(ref);
  const nextSeq = (snapshot.exists ? snapshot.data()!.seq : 0) + 1;
  const orderNumber = `ELR-${dateKey}-${String(nextSeq).padStart(4, "0")}`;

  return {
    orderNumber,
    commit: () => {
      if (snapshot.exists) {
        transaction.update(ref, { seq: nextSeq });
      } else {
        transaction.set(ref, { id: ref.id, seq: nextSeq });
      }
    },
  };
}
