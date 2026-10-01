import { ORDER_STATUSES, type OrderStatus } from "@/types/order";

/**
 * The Order Timeline on Admin > Order Details — built ONLY from what an order really records.
 *
 * An order stores its current `status`, `createdAt` and a single `updatedAt` (which a customer's edit also
 * bumps), but NO per-status history. So this shows progress, never times it does not have:
 *
 *  - the ordinary path is strictly linear (`PENDING → CONFIRMED → PREPARING → SHIPPED → DELIVERED`, no step
 *    can be skipped — see `order-status-transitions.ts`), so every step before the current one is certain to
 *    have happened: those are `done`, the current one is `current`, the rest `upcoming`;
 *  - the only timestamp that exists for any step is the order's placement, which is the PENDING step;
 *  - a CANCELLED order could have been cancelled from Pending, Confirmed or Preparing and nothing records
 *    which, so it shows just the placement step and the cancellation — it does not guess the steps between.
 *
 * Pure (no server-only import) so the page and its tests share one definition.
 */
export const TIMELINE_PATH = ORDER_STATUSES.filter((status) => status !== "CANCELLED");

export type TimelineStepState = "done" | "current" | "upcoming";

export type TimelineStep = {
  status: OrderStatus;
  state: TimelineStepState;
  /** True only for the one step the order really has a time for: its placement. */
  hasPlacedTime: boolean;
};

export function buildOrderTimeline(status: OrderStatus): TimelineStep[] {
  if (status === "CANCELLED") {
    return [
      { status: "PENDING", state: "done", hasPlacedTime: true },
      { status: "CANCELLED", state: "current", hasPlacedTime: false },
    ];
  }
  const currentIndex = TIMELINE_PATH.indexOf(status);
  return TIMELINE_PATH.map((step, index) => ({
    status: step,
    state: index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming",
    hasPlacedTime: step === "PENDING",
  }));
}
