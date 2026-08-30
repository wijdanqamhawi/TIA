import "server-only";
import type { DocumentReference, Transaction } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import {
  productsCollection,
  deliveryLocationsCollection,
  deliveryRegionsCollection,
  ordersCollection,
} from "@/lib/firebase/firestore";
import { isSelectedOptionValid } from "@/lib/domain/catalog/product.service";
import { isSoldOut } from "@/lib/domain/catalog/soldOut";
import { resolveOfferPricing } from "@/lib/domain/catalog/offer";
import { reserveOrderNumber } from "./order-number.service";
import { reserveStatsUpdate } from "@/lib/domain/admin/stats.service";
import type { Cart, CartItem } from "@/types/cart";
import type { Product } from "@/types/product";
import type { LocalizedString } from "@/types/localizedString";
import type { Order, OrderItem, PaymentMethodType } from "@/types/order";
import type { DeliveryRegionId } from "@/types/deliveryRegion";
import type { CheckoutInput } from "@/lib/validation/checkout.schema";

export type OrderLine = { productId: string; quantity: number };

export class InsufficientStockError extends Error {
  constructor(public readonly productId: string) {
    super(`Insufficient stock for product ${productId}`);
    this.name = "InsufficientStockError";
  }
}

export class ProductNotFoundError extends Error {
  constructor(public readonly productId: string) {
    super(`Product not found: ${productId}`);
    this.name = "ProductNotFoundError";
  }
}

/**
 * Decrements `stock` and increments `salesCount` for every line of an
 * order, inside the caller's Firestore transaction (research.md §3). This
 * is the core inventory-integrity primitive Phase 8's full order-creation
 * transaction (order number, snapshot, cart clearing, `stats/summary`)
 * builds on top of — not a duplicate of it.
 *
 * Every product is re-read via `transaction.get()` — never a stale outside
 * read — so two concurrent transactions racing for the last unit(s) can
 * never both succeed (data-model.md "Stock integrity"). All reads happen
 * before any write; if ANY line's stock is insufficient, this throws
 * before performing a single write, so the whole order aborts atomically
 * rather than partially applying (data-model.md, spec Edge Cases).
 */
export async function decrementStockForOrder(transaction: Transaction, lines: OrderLine[]): Promise<void> {
  const refs = lines.map((line) => productsCollection().doc(line.productId));
  const snapshots = await Promise.all(refs.map((ref) => transaction.get(ref)));

  snapshots.forEach((snapshot, index) => {
    const line = lines[index];
    if (!snapshot.exists) {
      throw new ProductNotFoundError(line.productId);
    }
    const stock = snapshot.data()?.stock ?? 0;
    if (line.quantity > stock) {
      throw new InsufficientStockError(line.productId);
    }
  });

  refs.forEach((ref, index) => {
    transaction.update(ref, {
      stock: FieldValue.increment(-lines[index].quantity),
      salesCount: FieldValue.increment(lines[index].quantity),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

// --- Full order-creation transaction (T123, spec User Story 1, FR-079/FR-092/FR-119/FR-121) ---

export type OrderLineErrorReason = "NOT_FOUND" | "NOT_AVAILABLE" | "SOLD_OUT" | "INVALID_OPTION" | "INSUFFICIENT_STOCK";

export class EmptyCartError extends Error {
  constructor() {
    super("Cannot create an order from an empty cart.");
    this.name = "EmptyCartError";
  }
}

export class UnsupportedDeliveryLocationError extends Error {
  constructor() {
    super("The selected delivery location is not currently supported.");
    this.name = "UnsupportedDeliveryLocationError";
  }
}

export class OrderLineValidationError extends Error {
  constructor(
    public readonly productId: string,
    public readonly reason: OrderLineErrorReason,
  ) {
    super(`Order line validation failed for ${productId}: ${reason}`);
    this.name = "OrderLineValidationError";
  }
}

function resolveOptionLabel(product: Product, selectedOption: CartItem["selectedOption"]): LocalizedString | null {
  if (!selectedOption) return null;
  const option = product.options.find((o) => o.key === selectedOption.optionKey);
  const value = option?.values.find((v) => v.key === selectedOption.valueKey);
  return value?.label ?? null;
}

export type CreateOrderInput = {
  /** `uid` for a registered customer's order; `null` for a guest checkout. */
  uid: string | null;
  /** The caller's already-resolved cart document reference (`carts/{uid}` or `guestCarts/{guestCartId}`). */
  cartRef: DocumentReference<Cart>;
  checkout: CheckoutInput;
  paymentMethodType: PaymentMethodType;
};

export type CreateOrderResult =
  | { ok: true; orderNumber: string }
  | { ok: false; error: { code: string; message: string; productId?: string } };

function orderLineErrorMessage(reason: OrderLineErrorReason): string {
  switch (reason) {
    case "NOT_FOUND":
      return "One of the items in your cart is no longer available.";
    case "NOT_AVAILABLE":
      return "One of the items in your cart is no longer available.";
    case "SOLD_OUT":
      return "One of the items in your cart is now sold out.";
    case "INVALID_OPTION":
      return "The selected option for one of your items is no longer available.";
    case "INSUFFICIENT_STOCK":
      return "One of the items in your cart exceeds the current available stock.";
  }
}

/**
 * The full, single-transaction order-creation flow (T123, research.md
 * §3–4, §42): re-reads authoritative cart/product/delivery-location data
 * **inside** the transaction, re-validates every line and the delivery
 * location, recomputes authoritative pricing via `resolveOfferPricing`
 * (Special Offers, spec FR-119/FR-121), builds immutable bilingual
 * `OrderItem` snapshots, generates the order number, creates the order
 * document, decrements stock/increments `salesCount`, updates `stats/
 * summary`, and clears the cart — all atomically. If any check fails, the
 * entire transaction aborts with no order created and the cart untouched
 * (spec Edge Cases).
 *
 * Never trusts a client-submitted price, total, stock value, Sold Out
 * state, promotional price, or delivery eligibility — every one of those
 * is re-derived here from a fresh, transaction-consistent Firestore read
 * (Constitution Principle 13, spec FR-026).
 */
export async function createOrder(
  db: FirebaseFirestore.Firestore,
  input: CreateOrderInput,
): Promise<CreateOrderResult> {
  try {
    const orderNumber = await db.runTransaction(async (transaction) => {
      // --- Read phase (every read must happen before any write) ---

      const cartSnapshot = await transaction.get(input.cartRef);
      const cartItems: CartItem[] = cartSnapshot.exists ? cartSnapshot.data()!.items : [];
      if (cartItems.length === 0) {
        throw new EmptyCartError();
      }

      const productRefs = cartItems.map((item) => productsCollection().doc(item.productId));
      const productSnapshots = await Promise.all(productRefs.map((ref) => transaction.get(ref)));

      const regionId = input.checkout.regionId as DeliveryRegionId;
      const regionSnapshot = await transaction.get(deliveryRegionsCollection().doc(regionId));
      const locationSnapshot = await transaction.get(deliveryLocationsCollection().doc(input.checkout.locationId));

      const pendingOrderNumber = await reserveOrderNumber(transaction);

      // --- Validation (still read-phase — no writes yet) ---

      if (
        !regionSnapshot.exists ||
        !regionSnapshot.data()!.isActive ||
        !locationSnapshot.exists ||
        locationSnapshot.data()!.regionId !== regionId ||
        !locationSnapshot.data()!.isActive
      ) {
        throw new UnsupportedDeliveryLocationError();
      }
      const region = regionSnapshot.data()!;
      const location = locationSnapshot.data()!;

      const orderItems: OrderItem[] = [];

      for (let i = 0; i < cartItems.length; i++) {
        const item = cartItems[i];
        const snapshot = productSnapshots[i];

        if (!snapshot.exists) {
          throw new OrderLineValidationError(item.productId, "NOT_FOUND");
        }
        const product = snapshot.data()!;

        if (!product.availability) {
          throw new OrderLineValidationError(item.productId, "NOT_AVAILABLE");
        }
        if (!isSelectedOptionValid(product, item.selectedOption)) {
          throw new OrderLineValidationError(item.productId, "INVALID_OPTION");
        }
        if (isSoldOut(product)) {
          throw new OrderLineValidationError(item.productId, "SOLD_OUT");
        }
        if (item.quantity > product.stock) {
          throw new OrderLineValidationError(item.productId, "INSUFFICIENT_STOCK");
        }

        const { offerStatus, effectivePrice } = resolveOfferPricing(product);
        const optionLabel = resolveOptionLabel(product, item.selectedOption);

        orderItems.push({
          productId: product.id,
          productName: product.name,
          selectedOption:
            item.selectedOption && optionLabel
              ? { optionKey: item.selectedOption.optionKey, valueKey: item.selectedOption.valueKey, label: optionLabel }
              : null,
          unitPrice: effectivePrice,
          originalPrice: product.price,
          wasOnSale: offerStatus === "ACTIVE",
          quantity: item.quantity,
        });
      }

      const subtotal = orderItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
      const total = subtotal;

      const pendingStats = await reserveStatsUpdate(transaction, total, 1);

      // --- Write phase ---

      const orderRef = ordersCollection().doc();
      transaction.set(orderRef, {
        id: orderRef.id,
        orderNumber: pendingOrderNumber.orderNumber,
        userId: input.uid,
        customerSnapshot: {
          fullName: input.checkout.fullName,
          email: input.checkout.email,
          phone: input.checkout.phone,
        },
        deliverySnapshot: {
          regionId,
          regionName: region.name,
          locationId: input.checkout.locationId,
          locationName: location.name,
          fullAddress: input.checkout.fullAddress,
        },
        items: orderItems,
        notes: input.checkout.notes ?? null,
        paymentMethod: input.paymentMethodType,
        status: "PENDING",
        subtotal,
        total,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Stock/salesCount are updated directly here (not via
      // `decrementStockForOrder`) because that helper does its own
      // `transaction.get()` re-read — calling it now, after `orderRef`'s
      // write above, would violate Firestore's "every read before any
      // write" transaction rule. The stock/quantity check already happened
      // against `productSnapshots` (read phase) with the exact same
      // guarantee: if the underlying document changed since that read,
      // Firestore's optimistic-concurrency check fails and retries/aborts
      // the whole transaction automatically (data-model.md "Stock integrity").
      productRefs.forEach((ref, i) => {
        transaction.update(ref, {
          stock: FieldValue.increment(-cartItems[i].quantity),
          salesCount: FieldValue.increment(cartItems[i].quantity),
          updatedAt: FieldValue.serverTimestamp(),
        });
      });

      pendingOrderNumber.commit();
      pendingStats.commit();

      transaction.update(input.cartRef, { items: [], updatedAt: FieldValue.serverTimestamp() });

      return pendingOrderNumber.orderNumber;
    });

    return { ok: true, orderNumber };
  } catch (err) {
    if (err instanceof EmptyCartError) {
      return { ok: false, error: { code: "EMPTY_CART", message: "Your cart is empty." } };
    }
    if (err instanceof UnsupportedDeliveryLocationError) {
      return {
        ok: false,
        error: { code: "LOCATION_NOT_SUPPORTED", message: "This delivery area is not currently supported." },
      };
    }
    if (err instanceof OrderLineValidationError) {
      return {
        ok: false,
        error: { code: err.reason, message: orderLineErrorMessage(err.reason), productId: err.productId },
      };
    }
    if (err instanceof ProductNotFoundError) {
      return { ok: false, error: { code: "NOT_FOUND", message: orderLineErrorMessage("NOT_FOUND"), productId: err.productId } };
    }
    if (err instanceof InsufficientStockError) {
      return {
        ok: false,
        error: { code: "INSUFFICIENT_STOCK", message: orderLineErrorMessage("INSUFFICIENT_STOCK"), productId: err.productId },
      };
    }
    throw err;
  }
}

/** Reads a single order by its human-readable, customer-facing order number (never the raw Firestore document ID). */
export async function getOrderByNumber(orderNumber: string): Promise<Order | null> {
  const snapshot = await ordersCollection().where("orderNumber", "==", orderNumber).limit(1).get();
  return snapshot.empty ? null : snapshot.docs[0].data();
}

// --- Customer order history (T136, spec User Story 2) ---

const ORDER_HISTORY_PAGE_SIZE = 10;

export type OrderHistoryResult = {
  orders: Order[];
  nextCursorId: string | null;
};

/**
 * The `userId`-scoped, paginated order-history query (T136) — filters on
 * `userId == uid` only, so a customer can never see another customer's
 * orders through this function (the same "own uid only" guarantee
 * `updateProfileAction` gives the profile itself). Never reads a
 * client-supplied uid — callers must pass the verified session's own
 * `uid` (Constitution Principle 6).
 */
export async function getOrdersForCustomer(
  uid: string,
  options?: { pageSize?: number; cursorId?: string | null },
): Promise<OrderHistoryResult> {
  const pageSize = options?.pageSize ?? ORDER_HISTORY_PAGE_SIZE;

  let query = ordersCollection().where("userId", "==", uid).orderBy("createdAt", "desc");

  if (options?.cursorId) {
    const cursorDoc = await ordersCollection().doc(options.cursorId).get();
    if (cursorDoc.exists) {
      query = query.startAfter(cursorDoc);
    }
  }

  const snapshot = await query.limit(pageSize).get();
  const orders = snapshot.docs.map((doc) => doc.data());
  const nextCursorId = orders.length === pageSize ? orders[orders.length - 1].id : null;

  return { orders, nextCursorId };
}

/**
 * Reads a single order by number, scoped to the requesting customer's own
 * `uid` — returns `null` both when the order doesn't exist and when it
 * exists but belongs to someone else (or is a guest order), so a caller
 * can never distinguish "not found" from "not yours" (this task's
 * explicit customer-isolation requirement; mirrors the guest-order-
 * confirmation access control's same never-leak-existence approach).
 */
export async function getOrderForCustomer(orderNumber: string, uid: string): Promise<Order | null> {
  const order = await getOrderByNumber(orderNumber);
  if (!order || order.userId !== uid) {
    return null;
  }
  return order;
}

// --- Server → Client Component serialization boundary (order history/detail) ---

export type OrderSummary = {
  id: string;
  orderNumber: string;
  createdAtISO: string;
  status: Order["status"];
  total: number;
  itemCount: number;
};

/** Strips Firestore `Timestamp`s (and full item detail) for the order-history list — never sent to a Client Component as-is. */
export function toOrderSummary(order: Order): OrderSummary {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    createdAtISO: order.createdAt.toDate().toISOString(),
    status: order.status,
    total: order.total,
    itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
  };
}
