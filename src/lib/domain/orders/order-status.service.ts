import "server-only";
import type { Transaction } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { productsCollection, ordersCollection } from "@/lib/firebase/firestore";
import type { OrderStatus } from "@/types/order";
import type { OrderLine } from "./order.service";
import { isValidOrderStatusTransition } from "./order-status-transitions";

export { getAllowedNextStatuses, isValidOrderStatusTransition } from "./order-status-transitions";

/**
 * Restocks and decrements `salesCount` for every line of a cancelled
 * order, inside the caller's transaction. This is the base cancellation/
 * restock function that Phase 10's order-status transition validator
 * (T162) builds on top of, not a duplicate of it (remediation finding F6).
 *
 * `salesCount` is only ever decremented here by exactly the quantity a
 * matching order-creation transaction (`decrementStockForOrder`) once
 * incremented it by, so it is not expected to go negative in normal
 * operation.
 */
export async function restockForCancellation(transaction: Transaction, lines: OrderLine[]): Promise<void> {
  for (const line of lines) {
    const ref = productsCollection().doc(line.productId);
    transaction.update(ref, {
      stock: FieldValue.increment(line.quantity),
      salesCount: FieldValue.increment(-line.quantity),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
}

export type OrderStatusTransitionResult =
  | { ok: true }
  | { ok: false; error: { code: "NOT_FOUND" | "INVALID_TRANSITION"; message: string } };

/**
 * The full order-status transition transaction (T162/T163, spec User Story
 * 3): re-reads the order's current status **inside** the transaction (never
 * trusting a stale status the admin UI last rendered), validates the
 * transition via `isValidOrderStatusTransition`, and — only when
 * transitioning into `CANCELLED` — restocks every line via
 * `restockForCancellation` in the same atomic write. Every other
 * transition only ever touches `status`/`updatedAt`.
 */
export async function transitionOrderStatus(
  db: FirebaseFirestore.Firestore,
  orderId: string,
  nextStatus: OrderStatus,
): Promise<OrderStatusTransitionResult> {
  return db.runTransaction(async (transaction): Promise<OrderStatusTransitionResult> => {
    const ref = ordersCollection().doc(orderId);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) {
      return { ok: false, error: { code: "NOT_FOUND", message: "This order no longer exists." } };
    }

    const order = snapshot.data()!;
    if (!isValidOrderStatusTransition(order.status, nextStatus)) {
      return {
        ok: false,
        error: {
          code: "INVALID_TRANSITION",
          message: `Cannot change status from ${order.status} to ${nextStatus}.`,
        },
      };
    }

    if (nextStatus === "CANCELLED") {
      const lines: OrderLine[] = order.items.map((item) => ({ productId: item.productId, quantity: item.quantity }));
      await restockForCancellation(transaction, lines);
    }

    transaction.update(ref, { status: nextStatus, updatedAt: FieldValue.serverTimestamp() });
    return { ok: true };
  });
}
