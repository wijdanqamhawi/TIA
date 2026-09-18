import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

// Every variant focuses to the same navy ring — one focus indicator across
// the whole storefront is both calmer and easier to spot than a per-variant
// colour.
//
// `primary` hovers *lighter* (an elevated navy), not darker: on a warm-white
// page a deepening button reads as pressed rather than as reachable.
// `secondary` is deliberately not a champagne slab — gold is jewellery on
// the interface, never a major button surface — so it is a navy-outlined
// warm-white counterpart to `primary` that fills to pearl on hover.
const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-brand-burgundy text-text-on-dark hover:bg-brand-burgundy-light",
  secondary:
    "border border-brand-burgundy bg-brand-ivory text-brand-burgundy hover:bg-brand-cream",
  outline:
    "border border-text-primary/25 bg-transparent text-text-primary hover:border-text-primary hover:bg-transparent",
  ghost: "text-text-primary hover:bg-brand-cream",
};

// Every size meets the shared touch-target-size minimum (research.md §18a,
// spec FR-050b) — `sm` is visually denser (less padding) but never
// shorter than 44px, so no button anywhere falls below that floor without
// each call site having to remember to override it.
const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-4 py-2 text-[0.625rem] min-h-11",
  md: "px-8 py-2.5 text-[0.6875rem] min-h-11",
  lg: "px-12 py-3.5 text-xs min-h-12",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          // Squared, not pill: the reference language is architectural.
          "inline-flex items-center justify-center gap-2 rounded-none font-medium",
          // Small wide-tracked uppercase is the editorial CTA convention;
          // both are dropped under RTL, where they damage Arabic.
          "uppercase tracking-[0.2em] rtl:normal-case rtl:tracking-normal rtl:text-xs",
          // Wide tracking is the single strongest "considered" signal on a
          // button. It is applied via `tracking-wide` rather than the
          // heavier `.eyebrow` treatment so Arabic labels stay readable —
          // Tailwind's `tracking-wide` is mild enough not to break the
          // joined letterforms the way the eyebrow's 0.22em would.
          "transition-colors duration-300",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-burgundy",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
