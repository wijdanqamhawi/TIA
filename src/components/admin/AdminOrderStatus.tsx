"use client";

import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { OrderStatusMenu } from "@/components/admin/OrderStatusMenu";
import { updateOrderStatusAction } from "@/actions/admin/order.actions";
import {
  getAllowedNextStatuses,
  isValidOrderStatusTransition,
} from "@/lib/domain/orders/order-status-transitions";
import { ORDER_STATUS_TONE } from "@/lib/ui/orderStatusTone";
import { buildOrderTimeline } from "@/lib/domain/orders/order-timeline";
import type { OrderStatus } from "@/types/order";

type StatusState = {
  status: OrderStatus;
  pending: boolean;
  notice: string | null;
  choose: (next: OrderStatus) => void;
};

const StatusContext = createContext<StatusState | null>(null);

function useOrderStatus(): StatusState {
  const state = useContext(StatusContext);
  if (!state) throw new Error("Order status components must be inside <OrderStatusProvider>.");
  return state;
}

/**
 * The single owner of one order's status on the Admin Order Details page. The header's clickable pill,
 * the "Current Status" card and the Order Information row all read the SAME status from here, so a
 * change shows everywhere at once (optimistically while saving, rolled back on failure).
 *
 * It adds no rules of its own — it is the Admin > Orders flow for a single order: the options come from
 * the existing transition table (`getAllowedNextStatuses`), a final status (Delivered / Cancelled) asks
 * for confirmation first, and the change goes through the existing protected `updateOrderStatusAction`,
 * which re-checks the transition against the order's CURRENT status in a transaction (cancelling also
 * restocks).
 */
export function OrderStatusProvider({
  orderId,
  status: serverStatus,
  children,
}: {
  orderId: string;
  status: OrderStatus;
  children: ReactNode;
}) {
  const t = useTranslations("AdminOrders");
  const router = useRouter();
  const [override, setOverride] = useState<OrderStatus | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<OrderStatus | null>(null);
  const inFlight = useRef(false);

  // A fresh status from the server (after `router.refresh()`) is the source of truth again.
  const [source, setSource] = useState(serverStatus);
  if (source !== serverStatus) {
    setSource(serverStatus);
    if (!pending) setOverride(null);
  }
  const status = override ?? serverStatus;

  async function apply(next: OrderStatus) {
    if (inFlight.current) return; // no double submits
    inFlight.current = true;
    setPending(true);
    setNotice(null);
    setOverride(next);

    const rollback = (message: string) => {
      setOverride(null);
      setNotice(message);
    };
    try {
      const result = await updateOrderStatusAction({ orderId, status: next });
      if (result.ok) {
        router.refresh();
      } else {
        rollback(result.error.message);
        // The order moved or vanished since this page loaded — show its real state.
        if (result.error.code === "INVALID_TRANSITION" || result.error.code === "NOT_FOUND")
          router.refresh();
      }
    } catch {
      rollback(t("statusMenu.failed"));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  function choose(next: OrderStatus) {
    if (inFlight.current) return;
    // The menu only offers valid transitions; this guards the handler as well. The server re-checks anyway.
    if (!isValidOrderStatusTransition(status, next)) return;
    if (getAllowedNextStatuses(next).length === 0) {
      setConfirm(next);
      return;
    }
    void apply(next);
  }

  return (
    <StatusContext.Provider value={{ status, pending, notice, choose }}>
      {children}
      {confirm ? (
        <ConfirmDialog
          titleId="order-status-confirm-title"
          title={t(`statusMenu.confirm.${confirm as "CANCELLED" | "DELIVERED"}.title`)}
          description={t(`statusMenu.confirm.${confirm as "CANCELLED" | "DELIVERED"}.body`)}
          cancelLabel={t("statusMenu.back")}
          confirmLabel={t(`statusMenu.confirm.${confirm as "CANCELLED" | "DELIVERED"}.action`)}
          tone={confirm === "CANCELLED" ? "danger" : "default"}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const next = confirm;
            setConfirm(null);
            void apply(next);
          }}
        />
      ) : null}
    </StatusContext.Provider>
  );
}

/** The clickable status pill (the same control as Admin > Orders) with any failure message beneath it. */
export function OrderStatusControl() {
  const t = useTranslations("AdminOrders");
  const { status, pending, notice, choose } = useOrderStatus();
  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <OrderStatusMenu
        status={status}
        label={t(`status.${status}`)}
        options={getAllowedNextStatuses(status).map((value) => ({
          status: value,
          label: t(`status.${value}`),
        }))}
        pending={pending}
        changeLabel={t("statusMenu.change")}
        menuLabel={t("statusMenu.menu")}
        currentLabel={t("statusMenu.current")}
        finalLabel={t("statusMenu.final")}
        align="end"
        onSelect={choose}
      />
      {notice ? (
        <p
          role="alert"
          data-testid="status-notice"
          className="max-w-[280px] text-[12.5px] text-[#a23f36]"
        >
          {notice}
        </p>
      ) : null}
    </div>
  );
}

/** A read-only status pill in the same tones, for places that only display the current status. */
export function OrderStatusBadge({
  className,
  variant = "pill",
}: {
  className?: string;
  /** `pill` — the tinted pill; `plain` — a dot and the label, no background (for summary figures and rows). */
  variant?: "pill" | "plain";
}) {
  const t = useTranslations("AdminOrders");
  const { status } = useOrderStatus();
  const tone = ORDER_STATUS_TONE[status];
  return (
    <span
      data-testid="order-status-badge"
      data-status={status}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap leading-none",
        variant === "pill"
          ? cn("h-[26px] rounded-full px-3 text-[12.5px]", tone.pill)
          : "gap-2 text-[inherit]",
        className,
      )}
    >
      <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", tone.dot)} />
      {t(`status.${status}`)}
    </span>
  );
}

/**
 * The Order Timeline: progress for the order's CURRENT status (so it follows an optimistic change like the
 * pills do) plus the one time an order records — its placement. See `order-timeline.ts`: no status history
 * exists, so no time is shown for any other step.
 */
export function OrderTimeline({ placed }: { placed: string }) {
  const t = useTranslations("AdminOrders");
  const { status } = useOrderStatus();
  const timeline = buildOrderTimeline(status);
  return (
    <div className="px-5 py-4" data-testid="order-timeline">
      <ol className="flex flex-col">
        {timeline.map((step, index) => {
          const last = index === timeline.length - 1;
          const tone = ORDER_STATUS_TONE[step.status];
          return (
            <li
              key={step.status}
              data-testid="timeline-step"
              data-status={step.status}
              data-state={step.state}
              aria-current={step.state === "current" ? "step" : undefined}
              className={cn("relative ps-8", last ? "pb-0" : "pb-5")}
            >
              {!last ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute start-[6.5px] top-5 bottom-0 w-px",
                    step.state === "done" ? "bg-brand-gold/70" : "bg-brand-burgundy/[0.12]",
                  )}
                />
              ) : null}
              <span
                aria-hidden="true"
                className={cn(
                  "absolute start-0 top-[3px] size-3.5 rounded-full",
                  step.state === "done" && "bg-brand-gold",
                  step.state === "current" && cn(tone.dot, "ring-4 ring-brand-gold/20"),
                  step.state === "upcoming" && "bg-[#dcdfe5]",
                )}
              />
              <p
                className={cn(
                  "flex flex-wrap items-center gap-2 text-[14.5px] leading-snug",
                  step.state === "upcoming"
                    ? "text-text-secondary"
                    : "font-medium text-brand-burgundy",
                )}
              >
                {t(`status.${step.status}`)}
                {step.state === "current" ? (
                  <span className="rounded-full bg-brand-cream px-2 py-0.5 text-[11.5px] font-normal leading-none text-text-secondary">
                    {t("detail.timeline.current")}
                  </span>
                ) : null}
              </p>
              {step.hasPlacedTime ? (
                <p className="mt-0.5 text-[12.5px] text-text-secondary lining-nums">{placed}</p>
              ) : null}
            </li>
          );
        })}
      </ol>
      <p className="mt-4 border-t border-brand-burgundy/[0.07] pt-3 text-[12px] leading-snug text-text-secondary">
        {t("detail.timeline.note")}
      </p>
    </div>
  );
}
