import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * A loading placeholder. The moving highlight (`.animate-elora-shimmer`,
 * globals.css) reads as "content is arriving" far more clearly than an
 * opacity pulse does, and is automatically stilled for a shopper who has
 * asked for reduced motion by the global `prefers-reduced-motion` rule —
 * leaving a calm pearl block rather than a flashing one.
 *
 * Square, not rounded: it stands in for product frames and copy, both of
 * which are square-cornered throughout the storefront.
 */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-elora-shimmer overflow-hidden rounded-none bg-brand-cream",
        className,
      )}
      {...props}
    />
  );
}
