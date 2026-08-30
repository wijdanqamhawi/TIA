import type { OrderStatus } from "@/types/order";

/**
 * The order-status state machine (T162, spec User Story 3): every
 * transition an admin may apply via `updateOrderStatusAction`. A terminal
 * status (`DELIVERED`/`CANCELLED`) has no further allowed transitions —
 * once cancelled or delivered, an order's status can never change again.
 * This is the single source of truth both `order-status.service.ts`
 * (server-only) and `OrderStatusSelect` (Client Component, T172) consult,
 * so the two can never drift — deliberately kept free of any `server-only`/
 * Admin SDK import so a Client Component can import it directly.
 */
const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

export function getAllowedNextStatuses(current: OrderStatus): OrderStatus[] {
  return ORDER_STATUS_TRANSITIONS[current];
}

export function isValidOrderStatusTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return false;
  return ORDER_STATUS_TRANSITIONS[from].includes(to);
}
