import { z } from "zod";

/**
 * Shared bilingual text shape (data-model.md "Shared type: LocalizedString",
 * spec FR-066–FR-085). `en` is always required — English is the fallback
 * language (spec FR-084); `ar` is nullable so a product/category can exist
 * before its Arabic content has been entered, without blocking creation
 * (spec FR-074). Reused by every bilingual field in every domain schema —
 * never redefine this shape inline elsewhere.
 */
export const localizedStringSchema = z.object({
  en: z.string().trim().min(1, "English text is required."),
  ar: z
    .string()
    .trim()
    .nullable()
    .transform((value) => (value === "" ? null : value)),
});

export type LocalizedStringInput = z.infer<typeof localizedStringSchema>;

/**
 * A looser variant for fields where even `en` is optional at the schema
 * level (the field itself is optional on the parent, e.g. `Category.description`).
 */
export const optionalLocalizedStringSchema = localizedStringSchema.nullable();
