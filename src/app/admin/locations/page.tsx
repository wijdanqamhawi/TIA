import {
  getAllDeliveryRegions,
  getAllDeliveryLocationsByRegion,
} from "@/lib/domain/delivery/deliveryLocation.service";
import {
  DeliveryLocationManager,
  type DeliveryRegionRow,
  type DeliveryLocationRow,
} from "@/components/admin/DeliveryLocationManager";

export const dynamic = "force-dynamic";

/** Admin — Delivery Locations (T284). */
export default async function AdminLocationsPage() {
  const regions = await getAllDeliveryRegions();
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
      <div>
        <h1 className="font-display text-2xl">Delivery Locations</h1>
        <p className="mt-1 text-sm text-text-primary/70">
          TIA delivers to exactly two regions — West Bank and Inside/1948 Areas. Relabel or
          reorder a region, and manage each region&apos;s cities/areas below.
        </p>
      </div>
      <DeliveryLocationManager regions={regionRows} locationsByRegion={locationsByRegion} />
    </div>
  );
}
