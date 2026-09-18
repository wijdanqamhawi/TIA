import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type BadgeVariant = "gold" | "burgundy" | "neutral" | "danger";

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

/**
 * `danger` (the Sold Out badge) deliberately does **not** use a raw red.
 * A saturated warning red is the one colour that most cheapens a luxury
 * catalogue, and Sold Out here is a neutral fact about stock, not an
 * error. It reads instead as a deep, desaturated burgundy-black with a
 * gold hairline — unmistakably "unavailable", still unmistakably ELORA.
 * The badge *text* is unchanged, so nothing that identifies a Sold Out
 * product by its label is affected.
 */
const variantClasses: Record<BadgeVariant, string> = {
  // The one restrained champagne moment in the catalogue grid.
  gold: "bg-brand-gold-muted text-brand-burgundy-dark",
  burgundy: "bg-brand-burgundy text-text-on-dark",
  neutral: "bg-brand-ivory/95 text-text-primary",
  // Sold Out stays a neutral fact about stock, never a red error state.
  danger: "bg-brand-burgundy-dark/90 text-text-on-dark",
};

export function Badge({ className, variant = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1.5 text-[0.5625rem] font-medium uppercase leading-none",
        // Wide tracking + uppercase is the badge's whole character in
        // Latin. Under RTL both are dropped (Arabic has no uppercase, and
        // letter-spacing breaks its joined forms) and the size steps up
        // slightly to keep the optical weight equivalent.
        "tracking-[0.18em] rtl:tracking-normal rtl:text-[0.6875rem] rtl:normal-case",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
