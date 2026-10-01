"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * The admin side drawer (Add / Edit panels on Categories and Showcases).
 *
 * A native modal `<dialog>`: focus trapping, Escape and an inert page behind
 * it come from the platform. Focus starts on the first field and returns to
 * whichever control opened the drawer once it unmounts; a click on the
 * backdrop closes it. It slides in from the inline-end side (right in
 * English, left in Arabic) and becomes a bottom sheet on phones.
 *
 * `children` is the drawer's form — give it `flex min-h-0 flex-1 flex-col`
 * with a scrollable body and a footer so long forms stay usable.
 */
export function AdminDrawer({
  titleId,
  title,
  subtitle,
  closeLabel,
  onClose,
  widthClassName = "sm:w-[400px]",
  titleClassName = "text-[22px]",
  children,
}: {
  titleId: string;
  title: string;
  subtitle?: string;
  closeLabel: string;
  onClose: () => void;
  /** Desktop width (from `sm`), e.g. `sm:w-[400px]`. */
  widthClassName?: string;
  /** Title size, e.g. a larger serif heading on a wider drawer. */
  titleClassName?: string;
  children: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const node = dialogRef.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (node && !node.open) node.showModal();
    node?.querySelector<HTMLElement>("input, select, textarea")?.focus();
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => {
      cancelAnimationFrame(frame);
      opener?.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // A click on the backdrop lands on the <dialog> itself, outside its box.
        if (e.target !== dialogRef.current) return;
        const box = dialogRef.current.getBoundingClientRect();
        const inside =
          e.clientX >= box.left &&
          e.clientX <= box.right &&
          e.clientY >= box.top &&
          e.clientY <= box.bottom;
        if (!inside) onClose();
      }}
      className={cn(
        // `open:flex`, not `flex`: an author `display` would override the
        // browser's hiding of a closed <dialog> before `showModal()` runs.
        // `max-w-none` lifts the browser's default dialog max-width, which otherwise clips the panel on phones.
        "fixed inset-auto m-0 max-h-[calc(100dvh-24px)] max-w-none flex-col overflow-hidden rounded-xl border border-brand-gold/[0.18] bg-white p-0 text-start text-brand-burgundy shadow-elev-3 open:flex",
        // Phones: a bottom sheet inset 12px from both sides. From `sm`: a panel on the inline-end side.
        "inset-x-3 bottom-3 w-auto sm:inset-x-auto sm:bottom-auto sm:end-4 sm:top-[72px] sm:max-h-[calc(100dvh-88px)]",
        widthClassName,
        "backdrop:bg-brand-burgundy/25",
        "transition-[opacity,translate] duration-300 ease-luxury",
        entered ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0 rtl:-translate-x-4",
      )}
    >
      <div className="flex shrink-0 items-start justify-between gap-3 px-6 pb-2 pt-5">
        <div className="min-w-0">
          <h2
            id={titleId}
            className={cn("font-display leading-tight text-brand-burgundy", titleClassName)}
          >
            {title}
          </h2>
          {subtitle ? <p className="mt-1 text-[13px] text-text-secondary">{subtitle}</p> : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="-me-2 -mt-1 grid size-10 shrink-0 place-items-center rounded-full text-text-secondary transition-colors hover:bg-brand-cream hover:text-brand-burgundy"
        >
          <X aria-hidden="true" className="size-[18px]" />
        </button>
      </div>
      {children}
    </dialog>
  );
}

/** Shared styling for drawer fields, so Categories and Showcases stay identical. */
export const DRAWER_FIELD =
  "block h-11 w-full rounded-lg border border-brand-burgundy/[0.12] bg-white px-3.5 text-[14px] text-brand-burgundy placeholder:text-text-secondary/80 transition-colors hover:border-brand-burgundy/25 focus-visible:border-brand-gold/70 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-gold/15 aria-[invalid=true]:border-red-600";
export const DRAWER_TEXTAREA =
  "block min-h-[52px] w-full resize-y rounded-lg border border-brand-burgundy/[0.12] bg-white px-3.5 py-2.5 text-[14px] leading-relaxed text-brand-burgundy placeholder:text-text-secondary/80 transition-colors hover:border-brand-burgundy/25 focus-visible:border-brand-gold/70 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-gold/15";
export const DRAWER_LABEL = "text-[13.5px] font-medium text-brand-burgundy";
export const DRAWER_ACTION =
  "inline-flex h-11 flex-1 items-center justify-center whitespace-nowrap rounded-md px-3 text-[12px] font-semibold uppercase tracking-[0.1em] transition-colors disabled:cursor-wait disabled:opacity-60 rtl:text-[13.5px] rtl:normal-case rtl:tracking-normal";
