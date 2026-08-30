import type { Timestamp } from "firebase-admin/firestore";
import type { LocalizedString } from "./localizedString";

/**
 * Exactly two ELORA JEWELLERY service regions, at two **fixed** document
 * IDs — the two-region limit is enforced structurally (only these values
 * are ever accepted), never by an editable list (data-model.md, spec
 * FR-086).
 */
export const DELIVERY_REGION_IDS = ["west-bank", "inside-1948"] as const;
export type DeliveryRegionId = (typeof DELIVERY_REGION_IDS)[number];

export function isDeliveryRegionId(value: string): value is DeliveryRegionId {
  return (DELIVERY_REGION_IDS as readonly string[]).includes(value);
}

/** `deliveryRegions/{regionId}` (data-model.md). */
export type DeliveryRegion = {
  id: string; // mirrors regionId
  regionId: DeliveryRegionId;
  name: LocalizedString;
  displayOrder: number;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
