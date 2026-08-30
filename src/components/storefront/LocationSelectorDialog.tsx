"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Dialog } from "@/components/ui/Dialog";
import { resolveLocalizedString } from "@/types/localizedString";
import type { LocalizedString } from "@/types/localizedString";
import type { DeliveryRegionId } from "@/types/deliveryRegion";

export type LocationOption = { id: string; name: LocalizedString; slug: string; searchTerms: string[] };
export type RegionOption = { regionId: DeliveryRegionId; name: LocalizedString };

/**
 * `LocationSelectorDialog` (T273, T274, spec FR-087/FR-088/FR-097): a
 * polished modal on desktop, a full-height/bottom-sheet drawer on mobile
 * (the shared `Dialog` primitive's own responsive width plus this
 * component's own full-height mobile override below), listing exactly
 * the two fixed regions, each with its active locations, and a bilingual
 * live search that matches against whichever locale is active — reusing
 * the exact `searchTerms` already generated server-side
 * (`buildDeliveryLocationSearchTerms`, T265) so search behaves
 * identically to every other bilingual search in this app.
 */
export function LocationSelectorDialog({
  open,
  onClose,
  locale,
  regions,
  locationsByRegion,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  locale: string;
  regions: RegionOption[];
  locationsByRegion: Record<string, LocationOption[]>;
  onSelect: (regionId: DeliveryRegionId, location: LocationOption) => void;
}) {
  const t = useTranslations("LocationSelector");
  const [query, setQuery] = useState("");

  const normalizedQuery = query.trim().toLowerCase();

  const filteredByRegion = useMemo(() => {
    if (!normalizedQuery) return locationsByRegion;
    const result: Record<string, LocationOption[]> = {};
    for (const region of regions) {
      const locations = locationsByRegion[region.regionId] ?? [];
      result[region.regionId] = locations.filter((location) => {
        const resolvedName = resolveLocalizedString(location.name, locale).toLowerCase();
        if (resolvedName.includes(normalizedQuery)) return true;
        return location.searchTerms.some((term) => term.includes(normalizedQuery));
      });
    }
    return result;
  }, [normalizedQuery, locationsByRegion, regions, locale]);

  const hasAnyResult = regions.some((region) => (filteredByRegion[region.regionId] ?? []).length > 0);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("dialogTitle")}
      className="sm:w-[min(90vw,32rem)] max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:m-0 max-sm:h-[85vh] max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none"
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-text-primary">
          {t("searchPlaceholder")}
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            className="min-h-11 rounded-md border border-border-luxury bg-brand-ivory px-3 py-2 text-text-primary placeholder:text-text-primary/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-burgundy"
          />
        </label>

        {!hasAnyResult ? (
          <p className="text-sm text-text-primary/70">{t("noResults")}</p>
        ) : (
          <div className="flex max-h-[60vh] flex-col gap-5 overflow-y-auto">
            {regions.map((region) => {
              const locations = filteredByRegion[region.regionId] ?? [];
              if (locations.length === 0) return null;
              return (
                <div key={region.regionId} className="flex flex-col gap-2">
                  <h3 className="font-display text-base text-text-primary">
                    {resolveLocalizedString(region.name, locale)}
                  </h3>
                  <ul className="flex flex-col gap-1">
                    {locations.map((location) => (
                      <li key={location.id}>
                        <button
                          type="button"
                          onClick={() => onSelect(region.regionId, location)}
                          className="min-h-11 w-full rounded-md px-3 py-2 text-start text-sm text-text-primary hover:bg-brand-beige focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-burgundy"
                        >
                          {resolveLocalizedString(location.name, locale)}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Dialog>
  );
}
