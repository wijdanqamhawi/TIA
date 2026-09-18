"use client";

import { useTranslations } from "next-intl";
import { Minus, Plus } from "lucide-react";

/** A touch-friendly, stock-bounded quantity stepper (product detail page). */
export function QuantitySelector({
  value,
  max,
  disabled,
  onChange,
}: {
  value: number;
  max: number;
  disabled?: boolean;
  onChange: (next: number) => void;
}) {
  const t = useTranslations("Common");

  function step(delta: number) {
    const next = Math.min(Math.max(value + delta, 1), Math.max(max, 1));
    onChange(next);
  }

  return (
    <div className="inline-flex h-[3.25rem] items-center border border-hairline-strong" aria-label={t("quantity")}>
      <button
        type="button"
        onClick={() => step(-1)}
        disabled={disabled || value <= 1}
        aria-label="-"
        className="flex h-full min-w-10 items-center justify-center text-text-primary transition-colors hover:bg-brand-cream disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Minus aria-hidden="true" size={16} />
      </button>
      <span className="min-w-10 px-2 text-center text-sm font-medium" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        onClick={() => step(1)}
        disabled={disabled || value >= max}
        aria-label="+"
        className="flex h-full min-w-10 items-center justify-center text-text-primary transition-colors hover:bg-brand-cream disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus aria-hidden="true" size={16} />
      </button>
    </div>
  );
}
