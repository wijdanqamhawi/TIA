import { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border-luxury p-10 text-center",
        className,
      )}
    >
      <p className="font-display text-lg text-text-primary">{title}</p>
      {description ? <p className="text-sm text-text-primary/70">{description}</p> : null}
      {action}
    </div>
  );
}
