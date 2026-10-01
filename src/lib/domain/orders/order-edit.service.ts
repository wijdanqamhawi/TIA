import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import {
  deliveryLocationsCollection,
  deliveryRegionsCollection,
  ordersCollection,
  productsCollection,
} from "@/lib/firebase/firestore";
import { isSelectedOptionValid } from "@/lib/domain/catalog/product.service";
import { reserveStatsUpdate } from "@/lib/domain/admin/stats.service";
import type { OrderItem } from "@/types/order";
import type { DeliveryRegionId } from "@/types/deliveryRegion";
import type { OrderEditInput } from "@/lib/validation/order-edit.schema";
import { isOrderEditable, orderItemKey, orderLineKey } from "./order-edit-rules";

export type OrderEditErrorCode =
  | "NOT_FOUND"
  | "NOT_EDITABLE"
  | "INVALID_LINE"
  | "EMPTY_ORDER"
  | "NOT_AVAILABLE"
  | "INVALID_OPTION"
  | "INSUFFICIENT_STOCK"
  | "LOCATION_NOT_SUPPORTED";

export type OrderEditResult =
  | { ok: true; orderNumber: string; total: number }
  | { ok: false; error: { code: OrderEditErrorCode; productId?: string } };

class OrderEditError extends Error {
  constructor(
    public readonly code: OrderEditErrorCode,
    public readonly productId?: string,
  ) {
    super(code);
  }
}

/**
 * A signed-in customer's edit of their OWN order, as one Firestore transaction on the SAME order
 * document (no second order record):
 *
 *  - ownership and the current status are read INSIDE the transaction — an admin's status change
 *    (itself a transaction on this document) either lands first, so this edit is rejected, or
 *    second, so it sees the new status on retry. Only PENDING passes `isOrderEditable`;
 *  - lines may only be kept (with a new quantity) or dropped; each is matched to an existing
 *    order line, so nothing new can be added and no price is taken from the client;
 *  - a kept line keeps its STORED `unitPrice`/`originalPrice`/`wasOnSale`, so an offer that has
 *    since ended never re-prices it; subtotal/total are recomputed from the stored prices;
 *  - stock follows the existing order flow (decremented at placement, restocked on cancel): the
 *    per-product DELTA (new − old quantity) is applied to `stock`/`salesCount`. An increase is
 *    checked against the freshly-read stock, so it can never oversell; a decrease/removal restocks.
 *    The quantities submitted are absolute, so repeating an identical submission changes nothing;
 *  - `stats/summary` totalSales moves by the change in total, as creation added it;
 *  - on any failure nothing is written.
 *
 * Never trusts a client price, total, stock or status.
 */
export async function editCustomerOrder(
  db: FirebaseFirestore.Firestore,
  uid: string,
  input: OrderEditInput,
): Promise<OrderEditResult> {
  try {
    const lookup = await ordersCollection()
      .where("orderNumber", "==", input.orderNumber)
      .limit(1)
      .get();
    if (lookup.empty) return { ok: false, error: { code: "NOT_FOUND" } };
    const orderRef = lookup.docs[0].ref;

    const result = await db.runTransaction(async (transaction) => {
      // --- Read phase ---
      const snapshot = await transaction.get(orderRef);
      const order = snapshot.exists ? snapshot.data()! : null;
      // Not found and not yours look identical.
      if (!order || !order.userId || order.userId !== uid) throw new OrderEditError("NOT_FOUND");
      if (!isOrderEditable(order.status)) throw new OrderEditError("NOT_EDITABLE");

      // Match every submitted line to an existing one (no additions, no duplicates).
      const submitted = new Map<string, number>();
      for (const line of input.items) {
        const key = orderLineKey(line);
        if (submitted.has(key)) throw new OrderEditError("INVALID_LINE", line.productId);
        submitted.set(key, line.quantity);
      }
      const existingKeys = new Set(order.items.map(orderItemKey));
      for (const key of submitted.keys()) {
        if (!existingKeys.has(key)) throw new OrderEditError("INVALID_LINE");
      }

      const items: OrderItem[] = order.items
        .filter((item) => submitted.has(orderItemKey(item)))
        .map((item) => ({ ...item, quantity: submitted.get(orderItemKey(item))! }));
      if (items.length === 0) throw new OrderEditError("EMPTY_ORDER");

      // Per-product quantity delta (a product may span several option lines).
      const delta = new Map<string, number>();
      for (const item of order.items) {
        const next = submitted.get(orderItemKey(item)) ?? 0;
        delta.set(item.productId, (delta.get(item.productId) ?? 0) + (next - item.quantity));
      }
      const changed = [...delta.entries()].filter(([, d]) => d !== 0);
      const productSnaps = await Promise.all(
        changed.map(([productId]) => transaction.get(productsCollection().doc(productId))),
      );

      const moved =
        order.deliverySnapshot.regionId !== input.regionId ||
        order.deliverySnapshot.locationId !== input.locationId;
      let regionSnap = null;
      let locationSnap = null;
      if (moved) {
        regionSnap = await transaction.get(deliveryRegionsCollection().doc(input.regionId));
        locationSnap = await transaction.get(deliveryLocationsCollection().doc(input.locationId));
      }

      const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
      const totalDelta = subtotal - order.total;
      const pendingStats =
        totalDelta !== 0 ? await reserveStatsUpdate(transaction, totalDelta, 0) : null;

      // --- Validation (still no writes) ---
      const stockWrites: Array<{ productId: string; delta: number }> = [];
      changed.forEach(([productId, d], index) => {
        const productSnap = productSnaps[index];
        if (d > 0) {
          if (!productSnap.exists) throw new OrderEditError("NOT_AVAILABLE", productId);
          const product = productSnap.data()!;
          if (!product.availability) throw new OrderEditError("NOT_AVAILABLE", productId);
          for (const item of items.filter((i) => i.productId === productId)) {
            if (!isSelectedOptionValid(product, item.selectedOption)) {
              throw new OrderEditError("INVALID_OPTION", productId);
            }
          }
          if (d > product.stock) throw new OrderEditError("INSUFFICIENT_STOCK", productId);
          stockWrites.push({ productId, delta: d });
        } else if (productSnap.exists) {
          // A reduction or removal returns the units (a deleted product has nothing to restock).
          stockWrites.push({ productId, delta: d });
        }
      });

      let deliverySnapshot = { ...order.deliverySnapshot, fullAddress: input.fullAddress };
      if (moved) {
        const region = regionSnap?.exists ? regionSnap.data()! : null;
        const location = locationSnap?.exists ? locationSnap.data()! : null;
        if (!region?.isActive || !location?.isActive || location.regionId !== input.regionId) {
          throw new OrderEditError("LOCATION_NOT_SUPPORTED");
        }
        deliverySnapshot = {
          regionId: input.regionId as DeliveryRegionId,
          regionName: region.name,
          locationId: input.locationId,
          locationName: location.name,
          fullAddress: input.fullAddress,
        };
      }

      // --- Write phase ---
      for (const { productId, delta: d } of stockWrites) {
        transaction.update(productsCollection().doc(productId), {
          stock: FieldValue.increment(-d),
          salesCount: FieldValue.increment(d),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      pendingStats?.commit();
      transaction.update(orderRef, {
        items,
        subtotal,
        total: subtotal,
        customerSnapshot: { ...order.customerSnapshot, phone: input.phone },
        deliverySnapshot,
        notes: input.notes ?? null,
        updatedAt: FieldValue.serverTimestamp(),
      });

      return { orderNumber: order.orderNumber, total: subtotal };
    });

    return { ok: true, ...result };
  } catch (err) {
    if (err instanceof OrderEditError) {
      return { ok: false, error: { code: err.code, productId: err.productId } };
    }
    throw err;
  }
}
