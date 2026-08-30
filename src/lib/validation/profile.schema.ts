import { z } from "zod";
import { nameSchema, phoneSchema } from "./auth.schema";
import { DELIVERY_REGION_IDS } from "@/types/deliveryRegion";

/**
 * `updateProfileAction`'s (T134) delivery-address input — validated
 * identically to checkout's `regionId`/`locationId` (`checkout.schema.ts`,
 * T118): `regionId` one of the two fixed values, `locationId` a non-empty
 * stable identifier, both re-verified against live Firestore data
 * wherever they're actually used for delivery eligibility (checkout's own
 * order-creation transaction) — this schema only enforces their
 * structural shape when a customer updates her saved profile address.
 */
export const profileAddressSchema = z.object({
  regionId: z.enum(DELIVERY_REGION_IDS, { message: "Select a delivery region." }),
  locationId: z.string().trim().min(1, "Select a delivery city/area."),
  addressLine: z
    .string()
    .trim()
    .min(1, "Address is required.")
    .max(500, "Address must be 500 characters or fewer."),
  notes: z
    .string()
    .trim()
    .max(1000, "Notes must be 1000 characters or fewer.")
    .nullable()
    .optional()
    .transform((value) => (value ? value : null)),
});

/**
 * `profileSchema` (T133): a registered customer's self-service profile —
 * name, optional phone, and an optional saved delivery address. Never
 * includes `email` (owned by Firebase Authentication, mirrored read-only
 * onto `users/{uid}.email` — data-model.md) or `role` (server-managed
 * only, Constitution Principle 6).
 */
export const profileSchema = z.object({
  name: nameSchema,
  phone: phoneSchema
    .nullable()
    .optional()
    .transform((value) => (value ? value : null)),
  address: profileAddressSchema.nullable().optional(),
});
export type ProfileInput = z.infer<typeof profileSchema>;
