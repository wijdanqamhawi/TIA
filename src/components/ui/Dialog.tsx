"use client";

import { ReactNode, useEffect, useRef } from "react";
import { cn } from "@/lib/utils/cn";

export type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
};

/**
 * Accessible modal dialog built on the native <dialog> element: focus
 * trapping, Escape-to-close, and a labeled title come from the platform
 * for free.
 */
export function Dialog({ open, onClose, title, children, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      aria-label={title}
      // Belt-and-suspenders alongside the native `dialog:not([open])` UA
      // default: a component that stays permanently mounted on every page
      // (e.g. `LocationSelector`'s dialog in the Navbar, unlike the admin
      // dialogs that only ever mount while open) can otherwise still
      // surface its closed content to accessibility/automation queries.
      className={cn(
        "m-auto rounded-lg border border-border-luxury bg-brand-ivory p-0 backdrop:bg-black/50",
        "w-[min(90vw,32rem)]",
        !open && "hidden",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-border-luxury p-4">
        <h2 className="font-display text-lg text-text-primary">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-md p-1 text-text-primary hover:bg-brand-beige focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-burgundy"
        >
          ×
        </button>
      </div>
      <div className="p-4">{children}</div>
    </dialog>
  );
}
