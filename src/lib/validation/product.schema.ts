import { z } from "zod";
import { localizedStringSchema } from "./localizedString.schema";
import { nonNegativeInt, stableId } from "./common";
import { validateOfferInput } from "@/lib/domain/catalog/offer";

/**
 * `Product.price`/order-line prices are stored as integers in minor units
 * (e.g. cents) to avoid floating-point drift (data-model.md, spec FR-077).
 */
export const priceMinorUnitsSchema = z
  .number()
  .int("Price must be a whole number of minor currency units (e.g. cents).")
  .positive("Price must be greater than 0.");

export const productImageSchema = z.object({
  // An absolute URL (an uploaded Firebase Storage image) or a root-relative
  // path (a local asset under `public/`). It was previously absolute-only,
  // which meant a product referencing a local asset could not be saved from
  // the admin form at all — the local-asset case is legitimate, so both
  // forms are accepted. Still rejects an empty or relative-with-no-slash
  // value, which is what the original rule was really guarding against.
  url: z
    .string()
    .trim()
    .min(1, "Image url is required.")
    .refine(
      (value) => /^https?:\/\//i.test(value) || value.startsWith("/"),
      "Image url must be an absolute URL or a root-relative path.",
    ),
  storagePath: z.string().trim().min(1, "Missing Firebase Storage path."),
  position: nonNegativeInt,
  alt: z.string().trim().min(1, "Alt text is required for every product image."),
  /** Optional option-value link for per-variant photography (see `ProductImage`). */
  valueKey: stableId.nullish(),
});
export type ProductImageInput = z.infer<typeof productImageSchema>;

export const productOptionValueSchema = z.object({
  key: stableId,
  label: localizedStringSchema,
});

export const productOptionSchema = z.object({
  key: stableId,
  name: localizedStringSchema,
  values: z.array(productOptionValueSchema).min(1, "An option must have at least one value."),
});
export type ProductOptionInput = z.infer<typeof productOptionSchema>;

/**
 * Input validation for creating/updating a `products/{productId}` document
 * (data-model.md, spec FR-074). System-managed fields — `slug`
 * (server-derived from `name.en`), `searchTerms` (server-derived),
 * `salesCount` (order-transaction-managed only), and the timestamps — are
 * deliberately excluded from this input schema; they are never
 * client-submitted (Constitution Principle 13).
 *
 * `isOnSale`/`salePrice`/`saleStartAt`/`saleEndAt` are the Special Offers
 * promotion fields (data-model.md "Offer status derivation", spec FR-113–
 * FR-114). Only `isOnSale`/`salePrice`/`price` are cross-validated here —
 * `saleStartAt`/`saleEndAt` are optional and, being independent bounds,
 * need no relative-order check (an end date before a start date simply
 * yields an offer that is never `ACTIVE`, which is safe, not invalid).
 */
const productFieldsSchema = z.object({
  name: localizedStringSchema,
  description: localizedStringSchema,
  material: localizedStringSchema,
  price: priceMinorUnitsSchema,
  categoryId: z.string().trim().min(1, "categoryId is required."),
  images: z.array(productImageSchema),
  options: z.array(productOptionSchema).default([]),
  stock: nonNegativeInt,
  availability: z.boolean(),
  isNewArrival: z.boolean().default(false),
  isBestSeller: z.boolean().default(false),
  isOnSale: z.boolean().default(false),
  salePrice: priceMinorUnitsSchema.nullable().default(null),
  saleStartAt: z.date().nullable().default(null),
  saleEndAt: z.date().nullable().default(null),
});

/**
 * A sale price is only meaningful while `isOnSale` is true, and must always
 * be strictly lower than the regular price (spec FR-114, SC-027) — enforced
 * here so an invalid combination can never be saved, client or server side,
 * for either the full create schema or a partial update. Delegates to
 * `validateOfferInput` (`lib/domain/catalog/offer.ts`) — the same function
 * the admin offer-management Server Action uses when validating a partial
 * update against the product's currently-stored price — so the rule can
 * never drift between the two call sites. When `price` isn't part of a
 * partial update payload, the `< price` comparison is skipped here (there
 * is nothing to compare against yet); the caller is responsible for
 * re-validating against the stored price before persisting.
 */
function withOfferRefinement<
  T extends z.ZodType<{ isOnSale?: boolean; salePrice?: number | null; price?: number }>,
>(schema: T) {
  return schema.superRefine((data, ctx) => {
    const message = validateOfferInput({
      isOnSale: Boolean(data.isOnSale),
      salePrice: data.salePrice ?? null,
      price: data.price ?? Infinity,
    });
    if (message) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["salePrice"], message });
    }
  });
}

export const productSchema = withOfferRefinement(productFieldsSchema);
export type ProductInput = z.infer<typeof productFieldsSchema>;

/**
 * Admin update input: `productId` targets the existing document; every
 * other field is independently optional for partial updates (e.g. only
 * adjusting `stock`), reusing the same field-level rules as `productSchema`.
 */
const updateProductFieldsSchema = productFieldsSchema.partial().extend({
  productId: z.string().trim().min(1, "productId is required."),
});
export const updateProductSchema = withOfferRefinement(updateProductFieldsSchema);
export type UpdateProductInput = z.infer<typeof updateProductFieldsSchema>;
