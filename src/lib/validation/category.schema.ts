import { z } from "zod";
import { localizedStringSchema, optionalLocalizedStringSchema } from "./localizedString.schema";
import { nonNegativeInt } from "./common";

/**
 * Input validation for creating/updating a `categories/{categoryId}`
 * document (data-model.md, spec FR-076). `slug` is derived server-side
 * from `name.en` (data-model.md) rather than admin-submitted, so it is not
 * part of this input schema; `categoryId`/`createdAt`/`updatedAt` are
 * likewise system-managed, never client-submitted.
 */
export const categorySchema = z.object({
  name: localizedStringSchema,
  description: optionalLocalizedStringSchema.optional(),
  displayOrder: nonNegativeInt,
  isActive: z.boolean(),
});
export type CategoryInput = z.infer<typeof categorySchema>;

/**
 * Admin create input (`createCategoryAction`). Stricter than an update:
 * a new category must be named in **both** languages up front, since it
 * appears in the bilingual storefront navigation as soon as it is active.
 */
export const createCategorySchema = categorySchema.extend({
  name: z.object({
    en: z.string().trim().min(1, "English name is required."),
    ar: z.string().trim().min(1, "Arabic name is required."),
  }),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

/**
 * Admin update input (spec FR-076, contracts/server-actions.md "Admin —
 * Categories"): `categoryId` is required to target an existing document;
 * every other field is independently optional so a partial update (e.g.
 * only toggling `isActive`) never requires resubmitting the whole record.
 */
export const updateCategorySchema = z.object({
  categoryId: z.string().trim().min(1, "categoryId is required."),
  name: localizedStringSchema.optional(),
  description: optionalLocalizedStringSchema.optional(),
  displayOrder: nonNegativeInt.optional(),
  isActive: z.boolean().optional(),
});
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
