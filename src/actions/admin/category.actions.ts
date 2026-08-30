"use server";

import { categoriesCollection } from "@/lib/firebase/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { ForbiddenError, requireAdmin, UnauthenticatedError } from "@/lib/firebase/guards";
import { updateCategorySchema } from "@/lib/validation/category.schema";
import { slugify } from "@/lib/utils/slugify";
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

async function assertUniqueCategorySlug(slug: string, excludeCategoryId: string): Promise<boolean> {
  const snapshot = await categoriesCollection().where("slug", "==", slug).limit(1).get();
  return snapshot.docs.every((doc) => doc.id === excludeCategoryId);
}

/**
 * `updateCategoryAction` (T155, spec FR-076): admin-only. Updates the
 * bilingual `name`/`description`, `isActive`, and/or `displayOrder` on an
 * **existing** `categories/{categoryId}` document only — this action never
 * creates or deletes a category (T155's explicit constraint; the storefront's
 * four core categories are fixed at seed time, T156). `slug` is re-derived
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
