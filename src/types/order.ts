import type { Timestamp } from "firebase-admin/firestore";
import type { LocalizedString } from "./localizedString";
import type { DeliveryRegionId } from "./deliveryRegion";

export const ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type OrderCustomerSnapshot = {
  fullName: string;
  email: string;
  phone: string;
};

export type OrderSelectedOptionSnapshot = {
  optionKey: string;
  valueKey: string;
  label: LocalizedString;
};

export type OrderDeliverySnapshot = {
  regionId: DeliveryRegionId;
  /** Bilingual snapshot of the region's display name at order time — never re-derived later (data-model.md). */
  regionName: LocalizedString;
  locationId: string;
  /** Bilingual snapshot of the location's display name at order time. */
  locationName: LocalizedString;
  fullAddress: string;
};

/**
 * A single immutable order line (spec FR-079/SC-007): the bilingual
 * product name and selected-option label are captured **as they exist at
 * the moment of purchase** — a later product edit, translation change, or
 * deletion never retroactively changes a past order.
 *
 * `originalPrice`/`wasOnSale` preserve enough pricing context to identify
 * a sale purchase later (e.g. in order history or an admin view) without
 * making live `Product` data authoritative for a historical order —
 * `unitPrice` alone (the actual amount charged) remains the only value
 * ever used in financial calculations (subtotal/total).
 */
export type OrderItem = {
  productId: string;
  productName: LocalizedString;
  selectedOption: OrderSelectedOptionSnapshot | null;
  /** The effective price actually charged at purchase time (regular or active sale price). */
  unitPrice: number;
  /** The product's regular price at purchase time, for display/record purposes only. */
  originalPrice: number;
  /** `true` when `unitPrice < originalPrice` — i.e. an `ACTIVE` Special Offer applied at purchase time. */
  wasOnSale: boolean;
  quantity: number;
};

export type PaymentMethodType = "CASH_ON_DELIVERY";

/**
 * `orders/{orderId}` (data-model.md). Created exactly once, entirely
 * inside the order-creation transaction; never mutated afterward except
 * `status`/`updatedAt` by an admin status transition (Phase 10) — the
 * snapshot fields are permanently immutable.
 */
export type Order = {
  id: string;
  /** Human-readable `ELR-YYYYMMDD-NNNN` — the only order identifier ever shown to a customer. */
  orderNumber: string;
  /** `uid` for a registered customer's order; `null` for a guest order. */
  userId: string | null;
  customerSnapshot: OrderCustomerSnapshot;
  deliverySnapshot: OrderDeliverySnapshot;
  items: OrderItem[];
  notes: string | null;
  paymentMethod: PaymentMethodType;
  status: OrderStatus;
  /** Integer minor units, server-recomputed at order-creation time — never client-submitted. */
  subtotal: number;
  /** Mirrors `subtotal` — no shipping/tax/discount computation exists in this feature. */
  total: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
