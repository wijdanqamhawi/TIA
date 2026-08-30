import { z } from "zod";
import { localizedStringSchema } from "./localizedString.schema";
import { nonNegativeInt } from "./common";
import { DELIVERY_REGION_IDS } from "@/types/deliveryRegion";

/**
 * Admin update input for `deliveryRegions/{regionId}` (T262, spec FR-086,
 * data-model.md). There is deliberately no create/delete schema — the two
 * regions are fixed at exactly `DELIVERY_REGION_IDS`, never an
 * admin-editable list; `regionId` here exists only to target which of the
 * two fixed documents to update, and is rejected outright if it isn't one
 * of them (mirrors the fixed-region validation in
 * `deliveryLocation.service.ts`, reused by `updateDeliveryRegionAction`).
 */
export const updateDeliveryRegionSchema = z.object({
  regionId: z.enum(DELIVERY_REGION_IDS),
  name: localizedStringSchema.optional(),
  displayOrder: nonNegativeInt.optional(),
  isActive: z.boolean().optional(),
});
export type UpdateDeliveryRegionInput = z.infer<typeof updateDeliveryRegionSchema>;
