import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type BadgeVariant = "gold" | "burgundy" | "neutral" | "danger";

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

const variantClasses: Record<BadgeVariant, string> = {
  gold: "bg-brand-gold text-brand-burgundy-dark",
  burgundy: "bg-brand-burgundy text-text-on-dark",
  neutral: "bg-brand-beige text-text-primary",
  danger: "bg-red-700 text-white",
};

export function Badge({ className, variant = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
