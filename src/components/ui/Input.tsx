import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => {
    return (
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          "block w-full min-h-11 rounded-none border bg-transparent px-4 py-2.5 text-text-primary",
          // Slate placeholder rather than faded navy: at 40% the old value
          // fell under AA, and a placeholder is real information.
          "transition-colors placeholder:text-text-secondary",
          // Focus matches every button in the storefront (navy ring), and
          // the resting border deepens on hover so a form field feels as
          // considered as the rest of the page.
          "hover:border-text-primary/40",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-burgundy",
          "disabled:cursor-not-allowed disabled:opacity-50",
          invalid ? "border-red-600" : "border-border-luxury",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
