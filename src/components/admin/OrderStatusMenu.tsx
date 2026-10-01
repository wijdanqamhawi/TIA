"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { OrderStatus } from "@/types/order";
import { ORDER_STATUS_TONE } from "@/lib/ui/orderStatusTone";

const PILL =
  "inline-flex h-[26px] items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[12.5px] leading-none";

export type OrderStatusOption = { status: OrderStatus; label: string };

/**
 * An order's status badge. With further statuses to offer it is a button —
 * `[ • Confirmed ▾ ]` — that opens a compact popover listing the current status
 * (marked, not selectable) and ONLY the statuses the parent says are reachable;
 * with none (a final status) it is a plain badge. It decides nothing itself:
 * the options come from the existing transition rules and the choice goes back
 * to the parent, which confirms and saves.
 *
 * Keyboard: Enter/Space/ArrowDown open it; ArrowUp/ArrowDown/Home/End move
 * between options, Enter chooses, Escape closes and returns focus to the pill,
 * Tab closes. A click outside closes it. While `pending` it shows a spinner and
 * ignores clicks (`aria-disabled`, so focus is not lost).
 */
export function OrderStatusMenu({
  status,
  label,
  options,
  pending,
  changeLabel,
  menuLabel,
  currentLabel,
  finalLabel,
  align = "start",
  onSelect,
}: {
  status: OrderStatus;
  label: string;
  /** The valid next statuses — empty for a final status. */
  options: OrderStatusOption[];
  pending: boolean;
  changeLabel: string;
  menuLabel: string;
  currentLabel: string;
  finalLabel: string;
  /**
   * Which edge of the badge the menu lines up with: `start` in the table, `end` where the badge sits at the
   * end of a card (so the menu opens toward the middle of the screen instead of running off it). Logical, so
   * it mirrors under RTL.
   */
  align?: "start" | "end";
  onSelect: (next: OrderStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const tone = ORDER_STATUS_TONE[status];

  // Close on an outside click; focus the first option when the menu opens.
  useEffect(() => {
    if (!open) return;
    itemRefs.current[0]?.focus();
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // A save started elsewhere (or this one) closes the menu.
  useEffect(() => {
    if (pending) setOpen(false);
  }, [pending]);

  const inner = (
    <>
      {pending ? (
        <Loader2 aria-hidden="true" className="size-3 shrink-0 animate-spin stroke-[2.2]" />
      ) : (
        <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", tone.dot)} />
      )}
      {label}
    </>
  );

  if (options.length === 0) {
    return (
      <span data-status={status} title={finalLabel} className={cn(PILL, tone.pill)}>
        {inner}
      </span>
    );
  }

  function close(refocus: boolean) {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = itemRefs.current.filter((el): el is HTMLButtonElement => el !== null);
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const focusAt = (next: number) => items[(next + items.length) % items.length]?.focus();
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusAt(index + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusAt(index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusAt(0);
        break;
      case "End":
        event.preventDefault();
        focusAt(items.length - 1);
        break;
      case "Escape":
        event.preventDefault();
        close(true);
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        data-status={status}
        data-testid="order-status-toggle"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${label} — ${changeLabel}`}
        aria-disabled={pending || undefined}
        aria-busy={pending || undefined}
        title={changeLabel}
        onClick={() => {
          if (!pending) setOpen((value) => !value);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !pending) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          PILL,
          tone.pill,
          "cursor-pointer outline-none ring-offset-1 transition-[box-shadow,opacity] hover:ring-1 hover:ring-current/30 focus-visible:ring-2 focus-visible:ring-brand-gold",
          pending && "cursor-wait opacity-70",
        )}
      >
        {inner}
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "size-3 shrink-0 stroke-[2] opacity-70 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label={menuLabel}
          onKeyDown={onMenuKeyDown}
          className={cn(
            "absolute top-full z-30 mt-1.5 flex min-w-[11.5rem] flex-col rounded-xl border border-brand-burgundy/[0.08] bg-white p-1.5 text-start shadow-elev-3",
            align === "end" ? "end-0" : "start-0",
          )}
        >
          {/* The current status: shown and marked, not selectable. */}
          <div
            role="menuitem"
            aria-disabled="true"
            aria-current="true"
            title={currentLabel}
            className="flex min-h-9 items-center gap-2.5 rounded-md px-3 text-[13px] text-text-secondary"
          >
            <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", tone.dot)} />
            <span className="flex-1">{label}</span>
            <Check aria-hidden="true" className="size-3.5 shrink-0 stroke-[2]" />
          </div>
          <div role="separator" className="my-1 h-px bg-brand-burgundy/[0.07]" />
          {options.map((option, index) => (
            <button
              key={option.status}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              type="button"
              role="menuitem"
              data-status-option={option.status}
              onClick={() => {
                setOpen(false);
                onSelect(option.status);
              }}
              className="flex min-h-9 w-full items-center gap-2.5 rounded-md px-3 text-start text-[13px] text-brand-burgundy outline-none transition-colors hover:bg-brand-cream focus-visible:bg-brand-cream"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  ORDER_STATUS_TONE[option.status].dot,
                )}
              />
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
