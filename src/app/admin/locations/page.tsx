import {
  getAllDeliveryRegions,
  getAllDeliveryLocationsByRegion,
} from "@/lib/domain/delivery/deliveryLocation.service";
import { MapPin } from "lucide-react";
import { getAdminTranslator } from "@/lib/i18n/admin";
import {
  DeliveryLocationManager,
  type DeliveryRegionRow,
  type DeliveryLocationRow,
} from "@/components/admin/DeliveryLocationManager";

export const dynamic = "force-dynamic";

/** Admin — Delivery Locations (T284). */
export default async function AdminLocationsPage() {
  const [regions, { t }] = await Promise.all([getAllDeliveryRegions(), getAdminTranslator("AdminDelivery")]);
  const locationsByEntries = await Promise.all(
    regions.map(async (region) => [region.regionId, await getAllDeliveryLocationsByRegion(region.regionId)] as const),
  );

  const regionRows: DeliveryRegionRow[] = regions.map((region) => ({
    regionId: region.regionId,
    name: region.name,
    displayOrder: region.displayOrder,
    isActive: region.isActive,
  }));

  const locationsByRegion: Record<string, DeliveryLocationRow[]> = Object.fromEntries(
    locationsByEntries.map(([regionId, locations]) => [
      regionId,
      locations.map((location) => ({
        id: location.id,
        regionId: location.regionId,
        name: location.name,
        slug: location.slug,
        displayOrder: location.displayOrder,
        isActive: location.isActive,
      })),
    ]),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3.5 pt-1">
        <span
          aria-hidden="true"
          className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#f8ece8] text-[#b8625a]"
        >
          <MapPin className="size-[22px] stroke-[1.6]" />
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-[28px] font-normal leading-[1.1] text-brand-burgundy lg:text-[34px] rtl:text-[26px] rtl:leading-[1.4] rtl:lg:text-[30px]">
            {t("title")}
          </h1>
          <p className="mt-1 max-w-[720px] font-display text-[14.5px] leading-snug text-text-secondary lg:text-[15.5px] rtl:font-body rtl:text-[14px]">
            {t("subtitle")}
          </p>
        </div>
      </div>
      <DeliveryLocationManager regions={regionRows} locationsByRegion={locationsByRegion} />
    </div>
  );
}
