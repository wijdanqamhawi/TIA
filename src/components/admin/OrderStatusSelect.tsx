"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getAllowedNextStatuses } from "@/lib/domain/orders/order-status-transitions";
import { updateOrderStatusAction } from "@/actions/admin/order.actions";
import { FormError } from "@/components/ui/FormError";
import type { OrderStatus } from "@/types/order";

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PREPARING: "Preparing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

/**
 * Admin order-status transition control (T172, spec User Story 3): only
 * ever offers the statuses `getAllowedNextStatuses` (the same state machine
 * `updateOrderStatusAction`/`transitionOrderStatus` enforce server-side)
 * says are reachable from the order's current status — a terminal order
 * (`DELIVERED`/`CANCELLED`) renders as plain, non-editable text. The
 * server-side transition check is still the actual authority regardless
 * (Constitution Principle 13).
 */
export function OrderStatusSelect({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const nextOptions = getAllowedNextStatuses(status);

  function handleChange(nextStatus: string) {
    if (!nextStatus || nextStatus === status) return;
    setError(null);
    startTransition(async () => {
      const result = await updateOrderStatusAction({ orderId, status: nextStatus });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  if (nextOptions.length === 0) {
    return <span className="text-sm font-medium">{STATUS_LABEL[status]}</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      <select
        aria-label="Order status"
        value={status}
        onChange={(e) => handleChange(e.target.value)}
        disabled={isPending}
        className="min-h-9 rounded-md border border-border-luxury bg-brand-ivory px-2 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-burgundy"
      >
        <option value={status}>{STATUS_LABEL[status]}</option>
        {nextOptions.map((option) => (
          <option key={option} value={option}>
            {STATUS_LABEL[option]}
          </option>
        ))}
      </select>
      <FormError message={error} />
    </div>
  );
}
