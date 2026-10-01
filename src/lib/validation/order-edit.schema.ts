import { z } from "zod";
import { checkoutSchema } from "./checkout.schema";

const nullableKey = z
  .string()
  .trim()
  .min(1)
  .nullable()
  .optional()
  .transform((value) => value ?? null);

/**
 * What a customer may submit when editing their own order: which existing lines remain (and their
 * quantities), the phone, the delivery place and the notes. Nothing else exists in the schema — a
 * client-supplied price, total, status, uid or stock value is not part of it and is stripped.
 * A removed line is simply absent from `items`; a quantity of 0 is never stored.
 */
export const orderEditSchema = z.object({
  orderNumber: z.string().trim().min(1),
  items: z
    .array(
      z.object({
        productId: z.string().trim().min(1),
        optionKey: nullableKey,
        valueKey: nullableKey,
        quantity: z.number().int().min(1).max(99),
      }),
    )
    .min(1, "An order needs at least one item."),
  phone: checkoutSchema.shape.phone,
  regionId: checkoutSchema.shape.regionId,
  locationId: checkoutSchema.shape.locationId,
  fullAddress: checkoutSchema.shape.fullAddress,
  notes: checkoutSchema.shape.notes,
});
export type OrderEditInput = z.infer<typeof orderEditSchema>;
