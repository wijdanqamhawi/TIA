"use server";

import { categoriesCollection } from "@/lib/firebase/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { ForbiddenError, requireAdmin, UnauthenticatedError } from "@/lib/firebase/guards";
import { createCategorySchema, updateCategorySchema } from "@/lib/validation/category.schema";
import { slugify } from "@/lib/utils/slugify";
import {
  actionError,
  actionOk,
  actionValidationError,
  type ActionResult,
} from "@/lib/validation/common";
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

async function assertUniqueCategorySlug(slug: string, excludeCategoryId: string): Promise<boolean> {
  const snapshot = await categoriesCollection().where("slug", "==", slug).limit(1).get();
  return snapshot.docs.every((doc) => doc.id === excludeCategoryId);
}

/**
 * `createCategoryAction`: admin-only. Adds a new `categories/{categoryId}`
 * document with the same shape as the seeded categories — the slug derived
 * from `name.en` doubles as the document id (as it does for `bracelets`,
 * `rings`, …), and `create()` refuses to overwrite an existing document.
 * Categories are still never deleted; an unwanted one is deactivated.
 */
export async function createCategoryAction(
  input: unknown,
): Promise<ActionResult<{ categoryId: string }>> {
  const guardResult = await guardAdmin();
  if (guardResult) return guardResult;

  const parsed = createCategorySchema.safeParse(input);
  if (!parsed.success) return actionValidationError(parsed.error);
  const { name, description, displayOrder, isActive } = parsed.data;

  const slug = slugify(name.en);
  if (!slug) {
    return actionError("VALIDATION_ERROR", "The English name must contain letters or numbers.", {
      name: ["The English name must contain letters or numbers."],
    });
  }
  if (!(await assertUniqueCategorySlug(slug, ""))) {
    return actionError("CONFLICT", "A category with this name already exists.");
  }

  const ref = categoriesCollection().doc(slug);
  try {
    await ref.create({
      id: slug,
      name,
      slug,
      description: description ?? null,
      displayOrder,
      isActive,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    // gRPC ALREADY_EXISTS — a category document with this id already exists.
    if ((err as { code?: unknown }).code === 6) {
      return actionError("CONFLICT", "A category with this name already exists.");
    }
    throw err;
  }

  invalidateStorefrontCatalog();
  return actionOk({ categoryId: slug });
}

/**
 * `updateCategoryAction` (T155, spec FR-076): admin-only. Updates the
 * bilingual `name`/`description`, `isActive`, and/or `displayOrder` on an
 * **existing** `categories/{categoryId}` document only — it never creates
 * (see `createCategoryAction`) or deletes a category. `slug` is re-derived
 * only when `name.en` actually changes.
 */
export async function updateCategoryAction(input: unknown): Promise<ActionResult<null>> {
  const guardResult = await guardAdmin();
  if (guardResult) return guardResult;

  const parsed = updateCategorySchema.safeParse(input);
  if (!parsed.success) return actionValidationError(parsed.error);
  const { categoryId, ...rest } = parsed.data;

  const ref = categoriesCollection().doc(categoryId);
  const snapshot = await ref.get();
  if (!snapshot.exists) return actionError("NOT_FOUND", "This category no longer exists.");
  const current = snapshot.data()!;

  let slug = current.slug;
  if (rest.name && rest.name.en !== current.name.en) {
    const newSlug = slugify(rest.name.en);
    if (newSlug !== current.slug) {
      const isUnique = await assertUniqueCategorySlug(newSlug, categoryId);
      if (!isUnique) return actionError("CONFLICT", "A category with this name already exists.");
      slug = newSlug;
    }
  }

  await ref.update({
    name: rest.name ?? current.name,
    slug,
    description: rest.description !== undefined ? rest.description : current.description,
    displayOrder: rest.displayOrder ?? current.displayOrder,
    isActive: rest.isActive ?? current.isActive,
    updatedAt: FieldValue.serverTimestamp(),
  });

  invalidateStorefrontCatalog();
  return actionOk(null);
}
