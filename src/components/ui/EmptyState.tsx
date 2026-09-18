import { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

/**
 * An empty cart/wishlist is a moment the shopper *will* see, so it is
 * composed rather than apologised for: a display-serif line, a champagne
 * hairline, and a single clear way onward. The previous dashed placeholder
 * border read as an unfinished admin screen; this reads as a deliberate
 * page.
 */
export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "mx-auto flex max-w-lg flex-col items-center justify-center gap-4 px-6 py-20 text-center sm:py-24",
        className,
      )}
    >
      <p className="font-display text-[clamp(1.375rem,2vw,1.875rem)] font-normal text-text-primary">{title}</p>
      {/* Symmetric, so it needs no RTL mirroring. */}
      <span aria-hidden="true" className="block h-px w-10 bg-brand-gold/60" />
      {description ? (
        <p className="max-w-sm text-[0.8125rem] leading-relaxed text-text-secondary">{description}</p>
      ) : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
