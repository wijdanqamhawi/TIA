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
          "block w-full min-h-11 rounded-md border bg-brand-ivory px-3 py-2 text-text-primary",
          "placeholder:text-text-primary/50",
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
