import { z } from "zod";
import { localizedStringSchema, optionalLocalizedStringSchema } from "./localizedString.schema";
import { nonNegativeInt } from "./common";

const showcaseImageSchema = z.object({
  // Same rule as `productImageSchema`: an absolute URL (a Storage upload) or
  // a root-relative local asset under `public/`, so a placeholder can be
  // stored without baking any environment's host into the data.
  url: z
    .string()
    .trim()
    .min(1, "Image url is required.")
    .refine(
      (value) => /^https?:\/\//i.test(value) || value.startsWith("/"),
      "Image url must be an absolute URL or a root-relative path.",
    ),
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
