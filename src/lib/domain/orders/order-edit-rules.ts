import type { OrderItem, OrderStatus } from "@/types/order";

/**
 * The only status in which a CUSTOMER may edit their own order: `PENDING`, before the store has
 * even confirmed it. From `CONFIRMED` on (PREPARING, SHIPPED, DELIVERED, CANCELLED) the order is fixed. Pure (no server-only import) so the UI's Edit button and the
 * server-side transaction consult the very same rule.
 */
export const CUSTOMER_EDITABLE_STATUSES: readonly OrderStatus[] = ["PENDING"];

export function isOrderEditable(status: OrderStatus): boolean {
  return CUSTOMER_EDITABLE_STATUSES.includes(status);
}

/** Identifies one order line: product + selected option (a product can appear once per option). */
export function orderLineKey(line: {
  productId: string;
  optionKey?: string | null;
  valueKey?: string | null;
}): string {
  return `${line.productId}::${line.optionKey ?? ""}::${line.valueKey ?? ""}`;
}

export function orderItemKey(item: OrderItem): string {
  return orderLineKey({
    productId: item.productId,
    optionKey: item.selectedOption?.optionKey,
    valueKey: item.selectedOption?.valueKey,
  });
}
