import { getTranslations } from "next-intl/server";
import { getActiveDeliveryRegions, getActiveDeliveryLocationsByRegion } from "@/lib/domain/delivery/deliveryLocation.service";
import { LocationSelector } from "./LocationSelector";
import { LanguageSwitcher } from "./LanguageSwitcher";

/**
 * The deep-navy announcement bar above the header, per the approved
 * reference: three zones on one 36px line —
 *
 *   start  — a short brand line
 *   centre — the brand statement, with a champagne spark and the italic
 *            champagne clause
 *   end    — the delivery-location trigger and the EN | AR switch
 *
 * ── A NOTE ON THE END ZONE ───────────────────────────────────────────────
 * The delivery-location trigger and the language switch were previously
 * removed from the header. The approved reference puts them back on this
 * bar, so they return here — reusing the existing `LocationSelector` and
 * `LanguageSwitcher` components unchanged. No delivery or locale logic is
 * modified: the selector still writes the same `elora_location` cookie and
 * checkout still re-validates independently.
 *
 * ── A NOTE ON THE START ZONE ─────────────────────────────────────────────
 * The reference reads "Free shipping on orders over $70". That is a
 * commercial promise this store has not made, and inventing one would put
 * a false offer in front of customers, so the slot carries the brand's own
 * existing motto instead. Swap in a real shipping key whenever the store
 * defines one.
 *
 * Below `lg` only the centre statement is kept: three zones cannot share a
 * 36px line on a phone without becoming unreadable.
 */
export async function AnnouncementBar({ locale }: { locale: string }) {
  const [tHome, tSplash, regions] = await Promise.all([
    getTranslations({ locale, namespace: "Home" }),
    getTranslations({ locale, namespace: "Splash" }),
    getActiveDeliveryRegions(),
  ]);

  // Same assembly the checkout page uses, so the dialog receives identical
  // option shapes wherever it is mounted.
  const entries = await Promise.all(
    regions.map(async (region) => {
      const locations = await getActiveDeliveryLocationsByRegion(region.regionId);
      return [
        region.regionId,
        locations.map((location) => ({
          id: location.id,
          name: location.name,
          slug: location.slug,
          searchTerms: location.searchTerms,
        })),
      ] as const;
    }),
  );
  const locationsByRegion = Object.fromEntries(entries);
  const regionOptions = regions.map((region) => ({ regionId: region.regionId, name: region.name }));

  return (
    <div className="bg-brand-burgundy text-text-on-dark">
      <div className="container-luxury flex h-9 items-center justify-between gap-4">
        <p className="hidden shrink-0 text-[0.6875rem] text-text-on-dark/75 lg:block rtl:text-xs">
          {tSplash("motto")}
        </p>

        <p className="mx-auto flex min-w-0 items-center gap-2 truncate text-[0.6875rem] text-text-on-dark/90 rtl:text-xs">
          <span className="truncate">{tHome("statementTitle")}</span>
          <span aria-hidden="true" className="shrink-0 text-brand-gold">
            <svg viewBox="0 0 24 24" className="size-2.5" fill="currentColor">
              <path d="M12 0 C12.6 7.4 16.6 11.4 24 12 C16.6 12.6 12.6 16.6 12 24 C11.4 16.6 7.4 12.6 0 12 C7.4 11.4 11.4 7.4 12 0Z" />
            </svg>
          </span>
          <span className="truncate italic text-brand-gold-muted rtl:not-italic">{tHome("statementSubtitle")}</span>
        </p>

        <div className="hidden shrink-0 items-center gap-1 lg:flex">
          <LocationSelector
            locale={locale}
            regions={regionOptions}
            locationsByRegion={locationsByRegion}
            className="flex min-h-9 items-center gap-1.5 px-2 text-[0.6875rem] font-medium text-text-on-dark/85 transition-opacity hover:text-text-on-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current rtl:text-xs"
          />
          <span aria-hidden="true" className="h-3 w-px bg-text-on-dark/25" />
          <LanguageSwitcher className="text-text-on-dark [&>button]:min-h-9 [&>button]:text-[0.625rem]" />
        </div>
      </div>
    </div>
  );
}
