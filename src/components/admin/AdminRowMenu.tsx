"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Ellipsis } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type RowMenuItem = {
  key: string;
  label: string;
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  /** `danger` is for destructive items (red text). */
  tone?: "default" | "danger";
  onSelect: () => void;
};

/**
 * A compact actions menu for a table row or card — a three-dot button by default,
 * or any custom trigger (e.g. a role badge) via `children`. It only lists the
 * items its parent passes — it decides nothing about who may do what, so a
 * caller must never hand it an action the viewer isn't authorized to perform.
 *
 * Keyboard: Enter/Space/ArrowDown open it onto the first item; ArrowUp/Down and
 * Home/End move between items, Enter/Space choose, Escape closes and returns
 * focus to the trigger, Tab closes. A click outside closes it. The panel opens
 * from the inline-end edge, so it mirrors under RTL.
 */
export function AdminRowMenu({
  label,
  menuLabel,
  items,
  children,
  triggerClassName,
  align = "end",
}: {
  /** Accessible name of the three-dot trigger, e.g. "Actions for Jane". */
  label: string;
  /** Accessible name of the popup menu itself. */
  menuLabel: string;
  items: RowMenuItem[];
  /** A custom trigger's content; omit for the default three-dot button. */
  children?: React.ReactNode;
  /** Replaces the default three-dot button styling when `children` is given. */
  triggerClassName?: string;
  /** Which edge of the trigger the panel lines up with (logical, so it mirrors under RTL). */
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!open) return;
    itemRefs.current[0]?.focus();
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  if (items.length === 0) return null;

  function close(refocus: boolean) {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const nodes = itemRefs.current.filter((el): el is HTMLButtonElement => el !== null);
    const index = nodes.indexOf(document.activeElement as HTMLButtonElement);
    const focusAt = (next: number) => nodes[(next + nodes.length) % nodes.length]?.focus();
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
        focusAt(nodes.length - 1);
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
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={
          children
            ? triggerClassName
            : "grid size-10 place-items-center rounded-lg border border-brand-burgundy/[0.1] bg-white text-brand-burgundy outline-none transition-colors hover:border-brand-gold/50 hover:bg-brand-ivory focus-visible:ring-2 focus-visible:ring-brand-gold md:size-9"
        }
      >
        {children ?? <Ellipsis aria-hidden="true" className="size-4 rotate-90" />}
      </button>
      {open ? (
        <div
          role="menu"
          aria-label={menuLabel}
          onKeyDown={onMenuKeyDown}
          className={cn(
            "absolute top-full z-20 mt-1.5 w-52 rounded-xl border border-brand-burgundy/[0.08] bg-white p-1.5 text-start shadow-elev-3",
            align === "end" ? "end-0" : "start-0",
          )}
        >
          {items.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={cn(
                  "flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-start text-[13.5px] outline-none transition-colors focus-visible:bg-brand-ivory",
                  item.tone === "danger"
                    ? "text-[#963a33] hover:bg-[#fbeeec] focus-visible:bg-[#fbeeec]"
                    : "text-brand-burgundy hover:bg-brand-ivory",
                )}
              >
                {Icon ? <Icon aria-hidden="true" className="size-4 shrink-0 stroke-[1.7]" /> : null}
                {item.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
