import type { Timestamp } from "firebase-admin/firestore";
import type { LocalizedString } from "./localizedString";
import type { DeliveryRegionId } from "./deliveryRegion";

/** `deliveryLocations/{locationId}` (data-model.md) — a city/area within a fixed `DeliveryRegion`. */
export type DeliveryLocation = {
  id: string; // Firestore auto-ID, mirrors locationId
  regionId: DeliveryRegionId;
  name: LocalizedString;
  slug: string; // unique per region, not globally
  searchTerms: string[];
  displayOrder: number;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
