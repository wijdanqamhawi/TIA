import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-none border border-hairline bg-brand-ivory",
        className,
      )}
      {...props}
    />
  );
}

// Header and footer divide with the gold hairline rather than the heavier
// beige border, so a card reads as one continuous surface with drawn
// rules inside it instead of three stacked boxes.
export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-b border-hairline p-5", className)} {...props} />;
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-t border-hairline p-5", className)} {...props} />;
}
