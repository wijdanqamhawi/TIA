import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-burgundy text-text-on-dark hover:bg-brand-burgundy-dark focus-visible:outline-brand-gold",
  secondary:
    "bg-brand-gold text-brand-burgundy-dark hover:bg-brand-gold-muted focus-visible:outline-brand-burgundy",
  outline:
    "border border-border-luxury text-text-primary hover:bg-brand-beige focus-visible:outline-brand-burgundy",
  ghost: "text-text-primary hover:bg-brand-beige focus-visible:outline-brand-burgundy",
};

// Every size meets the shared touch-target-size minimum (research.md §18a,
// spec FR-050b) — `sm` is visually denser (less padding) but never
// shorter than 44px, so no button anywhere falls below that floor without
// each call site having to remember to override it.
const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm min-h-11",
  md: "px-4 py-2.5 text-base min-h-11",
  lg: "px-6 py-3 text-lg min-h-12",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
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
