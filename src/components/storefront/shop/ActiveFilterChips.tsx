"use client";

import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { useRouter } from "@/lib/i18n/navigation";
import { buildShopHref, type ShopSearchParams } from "./shopQuery";

export type ActiveChip = {
  /** Which query key this chip clears. */
  key: keyof ShopSearchParams;
  label: string;
};

/**
 * Small removable chips for the filters currently applied. Each clears its
 * own query key and leaves the rest intact; "Clear all" returns to the bare
 * pathname. Renders nothing when no filter is active, so the grid sits
 * directly under the toolbar in the common case.
 */
export function ActiveFilterChips({
  pathname,
  current,
  chips,
}: {
  pathname: string;
  current: ShopSearchParams;
  chips: ActiveChip[];
}) {
  const t = useTranslations("Shop");
  const router = useRouter();

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label={t("activeFilters")}>
      {chips.map((chip) => (
        <button
          key={`${chip.key}:${chip.label}`}
          type="button"
          onClick={() => router.push(buildShopHref(pathname, current, { [chip.key]: undefined }))}
          aria-label={t("removeFilter", { label: chip.label })}
          className="inline-flex min-h-8 items-center gap-2 border border-hairline-strong bg-brand-cream px-3 text-[0.6875rem] text-text-primary transition-colors hover:border-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-burgundy"
        >
          {chip.label}
          <X aria-hidden="true" size={11} className="text-text-secondary" />
        </button>
      ))}

      <button
        type="button"
        onClick={() => router.push(pathname)}
        className="inline-flex min-h-8 items-center px-1 text-[0.6875rem] text-text-secondary underline-offset-4 transition-colors hover:text-text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-burgundy"
      >
        {t("clearAll")}
      </button>
    </div>
  );
}
