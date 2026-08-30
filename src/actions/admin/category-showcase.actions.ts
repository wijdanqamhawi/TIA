"use server";

import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { categoryShowcasesCollection } from "@/lib/firebase/firestore";
import { ForbiddenError, requireAdmin, UnauthenticatedError } from "@/lib/firebase/guards";
import { updateCategoryShowcaseSchema, categoryShowcaseSchema } from "@/lib/validation/categoryShowcase.schema";
import { categoryExists } from "@/lib/domain/catalog/category.service";
import { actionError, actionOk, actionValidationError, type ActionResult } from "@/lib/validation/common";
import { invalidateStorefrontCatalog } from "@/lib/cache/invalidate";

async function guardAdmin(): Promise<ActionResult<never> | null> {
  try {
    await requireAdmin();
    return null;
  } catch (err) {
    if (err instanceof UnauthenticatedError || err instanceof ForbiddenError) {
      return actionError("FORBIDDEN", "You do not have permission to perform this action.");
    }
    throw err;
  }
}

/**
 * `updateCategoryShowcaseAction` (T158, spec FR-001a–FR-001d): admin-only
 * update of one category's homepage merchandising section. `categoryId`
 * existence is re-verified server-side (T048) whenever it changes, never
 * trusted from the client form.
 */
export async function updateCategoryShowcaseAction(input: unknown): Promise<ActionResult<null>> {
  const guardResult = await guardAdmin();
  if (guardResult) return guardResult;

  const parsed = updateCategoryShowcaseSchema.safeParse(input);
  if (!parsed.success) return actionValidationError(parsed.error);
  const { showcaseId, ...rest } = parsed.data;

  const ref = categoryShowcasesCollection().doc(showcaseId);
  const snapshot = await ref.get();
  if (!snapshot.exists) return actionError("NOT_FOUND", "This showcase no longer exists.");
  const current = snapshot.data()!;

  if (rest.categoryId) {
    const ok = await categoryExists(rest.categoryId);
    if (!ok) {
      return actionError("VALIDATION_ERROR", "Selected category no longer exists.", {
        categoryId: ["Selected category no longer exists."],
      });
    }
  }

  await ref.update({
    categoryId: rest.categoryId ?? current.categoryId,
    title: rest.title ?? current.title,
    subtitle: rest.subtitle !== undefined ? rest.subtitle : current.subtitle,
    cta: rest.cta ?? current.cta,
    desktopImage: rest.desktopImage ?? current.desktopImage,
    mobileImage: rest.mobileImage !== undefined ? rest.mobileImage : current.mobileImage,
    displayOrder: rest.displayOrder ?? current.displayOrder,
    isActive: rest.isActive ?? current.isActive,
    updatedAt: FieldValue.serverTimestamp(),
  });

  invalidateStorefrontCatalog();
  return actionOk(null);
}

/**
 * `createCategoryShowcaseAction`: admin-only creation of a new homepage
 * showcase section, for a category that doesn't yet have one.
 */
export async function createCategoryShowcaseAction(input: unknown): Promise<ActionResult<{ showcaseId: string }>> {
  const guardResult = await guardAdmin();
  if (guardResult) return guardResult;

  const parsed = categoryShowcaseSchema.safeParse(input);
  if (!parsed.success) return actionValidationError(parsed.error);
  const data = parsed.data;

  const ok = await categoryExists(data.categoryId);
  if (!ok) {
    return actionError("VALIDATION_ERROR", "Selected category no longer exists.", {
      categoryId: ["Selected category no longer exists."],
    });
  }

  const ref = categoryShowcasesCollection().doc();
  await ref.set({
    id: ref.id,
    categoryId: data.categoryId,
    title: data.title,
    subtitle: data.subtitle ?? null,
    cta: data.cta,
    desktopImage: data.desktopImage,
    mobileImage: data.mobileImage ?? null,
    displayOrder: data.displayOrder,
    isActive: data.isActive,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  invalidateStorefrontCatalog();
  return actionOk({ showcaseId: ref.id });
}

/**
 * `attachShowcaseImageAction` (T159): records a freshly-uploaded (T148)
 * desktop or mobile showcase image on an existing showcase document.
 */
const attachShowcaseImageInputSchema = z.object({
  showcaseId: z.string().trim().min(1, "showcaseId is required."),
  slot: z.enum(["desktop", "mobile"]),
  image: z.object({
    url: z.string().trim().url("Image url must be a valid URL."),
    storagePath: z.string().trim().min(1, "Missing Firebase Storage path."),
  }),
});

export async function attachShowcaseImageAction(input: unknown): Promise<ActionResult<null>> {
  const guardResult = await guardAdmin();
  if (guardResult) return guardResult;

  const parsed = attachShowcaseImageInputSchema.safeParse(input);
  if (!parsed.success) return actionValidationError(parsed.error);
  const { showcaseId, slot, image } = parsed.data;

  const ref = categoryShowcasesCollection().doc(showcaseId);
  const snapshot = await ref.get();
  if (!snapshot.exists) return actionError("NOT_FOUND", "This showcase no longer exists.");

  await ref.update({
    [slot === "desktop" ? "desktopImage" : "mobileImage"]: image,
    updatedAt: FieldValue.serverTimestamp(),
  });

  invalidateStorefrontCatalog();
  return actionOk(null);
}
