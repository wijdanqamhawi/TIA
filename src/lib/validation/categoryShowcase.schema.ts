import { z } from "zod";
import { localizedStringSchema, optionalLocalizedStringSchema } from "./localizedString.schema";
import { nonNegativeInt } from "./common";

const showcaseImageSchema = z.object({
  url: z.string().trim().url("Image url must be a valid URL."),
  storagePath: z.string().trim().min(1, "Missing Firebase Storage path."),
});
export type ShowcaseImageInput = z.infer<typeof showcaseImageSchema>;

/**
 * Input validation for creating/updating a `categoryShowcases/{showcaseId}`
 * document (data-model.md, spec FR-001d). `categoryId` existence is
 * re-verified server-side (T048), never trusted from the client form.
 */
export const categoryShowcaseSchema = z.object({
  categoryId: z.string().trim().min(1, "categoryId is required."),
  title: localizedStringSchema,
  subtitle: optionalLocalizedStringSchema.optional(),
  cta: localizedStringSchema,
  desktopImage: showcaseImageSchema,
  mobileImage: showcaseImageSchema.nullable().optional(),
  displayOrder: nonNegativeInt,
  isActive: z.boolean(),
});
export type CategoryShowcaseInput = z.infer<typeof categoryShowcaseSchema>;

/**
 * Admin update input (contracts/server-actions.md "Admin — Category
 * Showcases"): `showcaseId` targets the existing document; every other
 * field is independently optional for a partial update.
 */
export const updateCategoryShowcaseSchema = categoryShowcaseSchema.partial().extend({
  showcaseId: z.string().trim().min(1, "showcaseId is required."),
});
export type UpdateCategoryShowcaseInput = z.infer<typeof updateCategoryShowcaseSchema>;
