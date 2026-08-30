import { z } from "zod";
import { emailSchema, nameSchema, phoneSchema } from "./auth.schema";
import { DELIVERY_REGION_IDS } from "@/types/deliveryRegion";

/**
 * `checkoutSchema` (T118, contracts/server-actions.md "Checkout / Orders",
 * spec FR-092). `regionId`/`locationId` replace the old free-text `city`
 * field: `regionId` must be one of the two fixed regions, `locationId` a
 * non-empty stable identifier — both are re-verified against **live**
 * `deliveryLocations`/`deliveryRegions` data inside the order-creation
 * transaction (`order.service.ts`), never trusted from this structural
 * check alone.
 *
 * `phone` reuses `phoneSchema` (already required, `auth.schema.ts`) — a
 * mandatory mobile phone number for every checkout, guest or registered
 * (this task's explicit requirement); `email` reuses the same required
 * `emailSchema` used at registration. Only `notes` is optional.
 */
export const checkoutSchema = z.object({
  fullName: nameSchema,
  phone: phoneSchema,
  regionId: z.enum(DELIVERY_REGION_IDS, { message: "Select a delivery region." }),
  locationId: z.string().trim().min(1, "Select a delivery city/area."),
  fullAddress: z
    .string()
    .trim()
    .min(1, "Address is required.")
    .max(500, "Address must be 500 characters or fewer."),
  email: emailSchema,
  notes: z
    .string()
    .trim()
    .max(1000, "Notes must be 1000 characters or fewer.")
    .nullable()
    .optional()
    .transform((value) => (value ? value : null)),
  paymentMethod: z.literal("CASH_ON_DELIVERY"),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;
