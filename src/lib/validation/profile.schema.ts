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
 * Optional date of birth as an ISO calendar date (`YYYY-MM-DD`): must be a
 * real date, not in the future, and not before 1900.
 */
export const dateOfBirthSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date of birth.")
  .refine((value) => {
    const [y, m, d] = value.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    const isRealDate = date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
    return isRealDate && y >= 1900 && date.getTime() <= Date.now();
  }, "Enter a valid date of birth.");

/**
 * `profileSchema` (T133): a registered customer's self-service profile —
 * name, optional phone, optional date of birth, and an optional saved
 * delivery address. Never includes `email` (owned by Firebase
 * Authentication, mirrored read-only onto `users/{uid}.email` —
 * data-model.md) or `role` (server-managed only, Constitution Principle 6).
 *
 * `address` and `dateOfBirth` are three-state: omitted (`undefined`) keeps
 * the stored value, `null` clears it, a value replaces it — so a form that
 * does not edit a field can never wipe it.
 */
export const profileSchema = z.object({
  name: nameSchema,
  phone: phoneSchema
    .nullable()
    .optional()
    .transform((value) => (value ? value : null)),
  dateOfBirth: dateOfBirthSchema.nullable().optional(),
  address: profileAddressSchema.nullable().optional(),
});
export type ProfileInput = z.infer<typeof profileSchema>;
