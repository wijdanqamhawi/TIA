"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { FormError } from "@/components/ui/FormError";

/**
 * A small confirmation dialog for destructive admin actions. A native modal
 * `<dialog>` (focus trap, Escape, inert page behind it), opened on mount, so
 * it also stacks correctly on top of an open `AdminDrawer`. Focus starts on
 * Cancel — the safe choice — and returns to whichever control opened it.
 * While `pending`, Escape and both buttons are inert. `tone="danger"` (the default) is for
 * destructive confirmations; `tone="default"` uses the navy primary button.
 */
export function ConfirmDialog({
  titleId,
  title,
  description,
  cancelLabel,
  confirmLabel,
  pending = false,
  tone = "danger",
  error,
  onCancel,
  onConfirm,
}: {
  titleId: string;
  title: string;
  description: string;
  cancelLabel: string;
  confirmLabel: string;
  pending?: boolean;
  tone?: "danger" | "default";
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const node = dialogRef.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (node && !node.open) node.showModal();
    cancelRef.current?.focus();
    return () => opener?.focus();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={`${titleId}-description`}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onCancel();
      }}
      className="fixed inset-0 m-auto h-fit w-[min(420px,calc(100vw-32px))] max-w-none rounded-xl border border-brand-gold/[0.18] bg-white p-0 text-start text-brand-burgundy shadow-elev-3 backdrop:bg-brand-burgundy/30"
    >
      <div className="flex flex-col gap-2 px-6 pb-4 pt-6">
        <h2 id={titleId} className="font-display text-[22px] leading-tight text-brand-burgundy">
          {title}
        </h2>
        <p
          id={`${titleId}-description`}
          className="text-[14px] leading-relaxed text-text-secondary"
        >
          {description}
        </p>
        <FormError message={error} className="mt-1 text-[13px]" />
      </div>
      <div className="grid grid-cols-2 gap-3 border-t border-brand-burgundy/[0.06] px-6 pb-5 pt-4">
        <button
          ref={cancelRef}
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="inline-flex h-11 items-center justify-center rounded-md border border-brand-gold/50 bg-white px-3 text-[12px] font-semibold uppercase tracking-[0.1em] text-brand-burgundy outline-none transition-colors hover:border-brand-gold hover:bg-brand-ivory focus-visible:ring-2 focus-visible:ring-brand-gold/50 disabled:cursor-wait disabled:opacity-60 rtl:text-[13.5px] rtl:normal-case rtl:tracking-normal"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className={cn(
            "inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 text-[12px] font-semibold uppercase tracking-[0.1em] text-white outline-none transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 rtl:text-[13.5px] rtl:normal-case rtl:tracking-normal",
            tone === "danger"
              ? "bg-[#963a33] hover:bg-[#7f2f29] focus-visible:ring-[#963a33]/50"
              : "bg-brand-burgundy hover:bg-brand-burgundy-light focus-visible:ring-brand-gold",
          )}
        >
          {pending ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin stroke-[2]" />
          ) : null}
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
