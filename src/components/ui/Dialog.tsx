"use client";

import { ReactNode, useEffect, useRef } from "react";
import { X } from "lucide-react";
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
        // The gold hairline ring reads as a drawn edge rather than a UI
        // border, and the softened backdrop (blur + warm tint instead of
        // flat black) keeps the page behind recognisably ELORA.
        "m-auto overflow-hidden rounded-none border border-hairline bg-brand-ivory p-0 shadow-elev-3",
        "backdrop:bg-brand-burgundy-dark/55 backdrop:backdrop-blur-sm",
        "w-[min(92vw,32rem)]",
        !open && "hidden",
        className,
      )}
    >
      {/* The entrance animation lives on this inner panel, never on the
          <dialog> itself, so native focus-trapping and Escape handling are
          untouched. It is stilled automatically under reduced-motion. */}
      <div className={cn(open && "animate-elora-dialog-in")}>
        <div className="flex items-center justify-between gap-4 border-b border-hairline px-6 py-5">
          <h2 className="font-display text-2xl font-light text-text-primary">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            // Was a bare "×" glyph in a 1-unit padded box, which fell well
            // under the 44px touch-target floor every other control meets.
            className="-me-2 flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-text-primary/70 transition-colors hover:bg-brand-beige hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-burgundy"
          >
            <X aria-hidden="true" size={18} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </dialog>
  );
}
