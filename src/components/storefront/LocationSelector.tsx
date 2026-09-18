"use client";

import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { LocationSelectorDialog, type RegionOption, type LocationOption } from "./LocationSelectorDialog";
import {
  LOCATION_COOKIE_NAME,
  LOCATION_COOKIE_CLIENT_ATTRIBUTES,
  encodeLocationSelection,
  decodeLocationSelection,
} from "@/lib/domain/delivery/location-selection";
import { resolveLocalizedString } from "@/types/localizedString";
import { syncLocationSelectionAction } from "@/actions/account.actions";
import type { DeliveryRegionId } from "@/types/deliveryRegion";

function readClientLocationCookie(): { regionId: DeliveryRegionId; locationId: string } | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCATION_COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  return decodeLocationSelection(decodeURIComponent(match[1]));
}

/**
 * `LocationSelector` (T272, T275, T276, spec FR-087/FR-090): the persistent
 * trigger mounted in both the desktop Navbar and the mobile hamburger menu
 * — shows the currently-selected city, or a "Select delivery location"
 * prompt. Reads the persisted selection client-side (`document.cookie`,
 * mirrors `NEXT_LOCALE`) so it reflects the right label even on a page the
 * server rendered before any selection existed, and re-reads it after
 * every selection so the label updates immediately without a full reload.
 */
export function LocationSelector({
  locale,
  regions,
  locationsByRegion,
  className,
}: {
  locale: string;
  regions: RegionOption[];
  locationsByRegion: Record<string, LocationOption[]>;
  className?: string;
}) {
  const t = useTranslations("LocationSelector");
  const [open, setOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

  useEffect(() => {
    const selection = readClientLocationCookie();
    if (!selection) return;
    const location = (locationsByRegion[selection.regionId] ?? []).find((loc) => loc.id === selection.locationId);
    if (location) setSelectedLabel(resolveLocalizedString(location.name, locale));
  }, [locationsByRegion, locale]);

  function handleSelect(regionId: DeliveryRegionId, location: LocationOption) {
    const value = encodeLocationSelection({ regionId, locationId: location.id });
    document.cookie = `${LOCATION_COOKIE_NAME}=${encodeURIComponent(value)}${LOCATION_COOKIE_CLIENT_ATTRIBUTES}`;
    setSelectedLabel(resolveLocalizedString(location.name, locale));
    setOpen(false);
    // Best-effort only — a guest or a customer with no saved address yet
    // has nothing to sync into; the cookie above is already the source of
    // truth for prefill, and checkout always re-validates regardless.
    void syncLocationSelectionAction({ regionId, locationId: location.id });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "flex min-h-11 items-center gap-1.5 rounded-full px-2 text-xs font-medium text-current opacity-80 transition-opacity hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        }
      >
        <MapPin aria-hidden="true" size={16} />
        <span className="max-w-[8rem] truncate">{selectedLabel ?? t("trigger")}</span>
      </button>

      <LocationSelectorDialog
        open={open}
        onClose={() => setOpen(false)}
        locale={locale}
        regions={regions}
        locationsByRegion={locationsByRegion}
        onSelect={handleSelect}
      />
    </>
  );
}
