"use server";

import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { productsCollection } from "@/lib/firebase/firestore";
import { ForbiddenError, requireAdmin, UnauthenticatedError } from "@/lib/firebase/guards";
import { productImageSchema } from "@/lib/validation/product.schema";
import { actionError, actionOk, actionValidationError, type ActionResult } from "@/lib/validation/common";
import { invalidateStorefrontCatalog } from "@/lib/cache/invalidate";
import type { ProductImage } from "@/types/product";

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
 * Product image management (T149) — called after `ImageUploader` (T148)
 * has already put the file in Firebase Storage; these actions only ever
 * record/reorder/remove the Firestore-side `images` array metadata, never
 * touch Storage bytes themselves beyond the delete-on-remove below.
 * `position` is always server-derived from array order, never client-
 * submitted, so it can never desync from the actual array (data-model.md
 * "Derived-never-stored").
 */
const attachImageInputSchema = z.object({
  productId: z.string().trim().min(1, "productId is required."),
  image: productImageSchema.omit({ position: true }),
});

export async function attachUploadedImageAction(input: unknown): Promise<ActionResult<null>> {
  const guardResult = await guardAdmin();
  if (guardResult) return guardResult;

  const parsed = attachImageInputSchema.safeParse(input);
  if (!parsed.success) return actionValidationError(parsed.error);
  const { productId, image } = parsed.data;

  const ref = productsCollection().doc(productId);
  const snapshot = await ref.get();
  if (!snapshot.exists) return actionError("NOT_FOUND", "This product no longer exists.");

  const images: ProductImage[] = [...snapshot.data()!.images, { ...image, position: snapshot.data()!.images.length }];
  await ref.update({ images, updatedAt: FieldValue.serverTimestamp() });
  invalidateStorefrontCatalog();
  return actionOk(null);
}

const reorderImagesInputSchema = z.object({
  productId: z.string().trim().min(1, "productId is required."),
  orderedStoragePaths: z.array(z.string().trim().min(1)).min(1),
});

export async function reorderProductImagesAction(input: unknown): Promise<ActionResult<null>> {
  const guardResult = await guardAdmin();
  if (guardResult) return guardResult;

  const parsed = reorderImagesInputSchema.safeParse(input);
  if (!parsed.success) return actionValidationError(parsed.error);
  const { productId, orderedStoragePaths } = parsed.data;

  const ref = productsCollection().doc(productId);
  const snapshot = await ref.get();
  if (!snapshot.exists) return actionError("NOT_FOUND", "This product no longer exists.");

  const current = snapshot.data()!.images;
  const byPath = new Map(current.map((img) => [img.storagePath, img]));
  const reordered = orderedStoragePaths
    .map((path) => byPath.get(path))
    .filter((img): img is ProductImage => Boolean(img))
    .map((img, index) => ({ ...img, position: index }));

  if (reordered.length !== current.length) {
    return actionError("VALIDATION_ERROR", "The image list is out of date. Reload and try again.");
  }

  await ref.update({ images: reordered, updatedAt: FieldValue.serverTimestamp() });
  invalidateStorefrontCatalog();
  return actionOk(null);
}

const removeImageInputSchema = z.object({
  productId: z.string().trim().min(1, "productId is required."),
  storagePath: z.string().trim().min(1, "storagePath is required."),
});

export async function removeProductImageAction(input: unknown): Promise<ActionResult<null>> {
  const guardResult = await guardAdmin();
  if (guardResult) return guardResult;

  const parsed = removeImageInputSchema.safeParse(input);
  if (!parsed.success) return actionValidationError(parsed.error);
  const { productId, storagePath } = parsed.data;

  const ref = productsCollection().doc(productId);
  const snapshot = await ref.get();
  if (!snapshot.exists) return actionError("NOT_FOUND", "This product no longer exists.");

  const images = snapshot
    .data()!
    .images.filter((img) => img.storagePath !== storagePath)
    .map((img, index) => ({ ...img, position: index }));

  await ref.update({ images, updatedAt: FieldValue.serverTimestamp() });

  try {
    const { getAdminStorage } = await import("@/lib/firebase/admin");
    await getAdminStorage().bucket().file(storagePath).delete({ ignoreNotFound: true });
  } catch {
    // Firestore metadata is already updated; a leftover Storage object is
    // not a correctness issue (never re-surfaced anywhere), so a delete
    // failure here is not returned as an action error.
  }

  invalidateStorefrontCatalog();
  return actionOk(null);
}
