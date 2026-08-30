import { z } from "zod";
import { localizedStringSchema } from "./localizedString.schema";
import { nonNegativeInt } from "./common";
import { DELIVERY_REGION_IDS } from "@/types/deliveryRegion";

/**
 * Input validation for creating/updating a `deliveryLocations/{locationId}`
 * document (T263, spec FR-089, data-model.md). `slug`/`searchTerms` are
 * derived server-side (mirrors `productSchema`) so they are not part of
 * this input; `regionId` MUST be one of the two fixed regions (never a
 * client-invented value) — enforced here at the schema layer as the first
 * defense, and again by `assertValidDeliveryRegionId` (T266) at the
 * service layer for callers that bypass this schema (e.g. checkout
 * revalidation, which never accepts a `regionId` input at all — it only
 * ever reads the customer's already-validated selection).
 */
export const deliveryLocationSchema = z.object({
  regionId: z.enum(DELIVERY_REGION_IDS),
  name: localizedStringSchema,
  displayOrder: nonNegativeInt,
  isActive: z.boolean(),
});
export type DeliveryLocationInput = z.infer<typeof deliveryLocationSchema>;

export const updateDeliveryLocationSchema = z.object({
  locationId: z.string().trim().min(1, "locationId is required."),
  name: localizedStringSchema.optional(),
  displayOrder: nonNegativeInt.optional(),
  isActive: z.boolean().optional(),
});
export type UpdateDeliveryLocationInput = z.infer<typeof updateDeliveryLocationSchema>;

export const deleteDeliveryLocationSchema = z.object({
  locationId: z.string().trim().min(1, "locationId is required."),
});
export type DeleteDeliveryLocationInput = z.infer<typeof deleteDeliveryLocationSchema>;
