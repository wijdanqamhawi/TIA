"use server";

import { z } from "zod";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { productsCollection } from "@/lib/firebase/firestore";
import { ForbiddenError, requireAdmin, UnauthenticatedError } from "@/lib/firebase/guards";
import { productSchema, updateProductSchema } from "@/lib/validation/product.schema";
import { validateOfferInput } from "@/lib/domain/catalog/offer";
import { deriveProductSlug, assertUniqueProductSlug } from "@/lib/domain/catalog/product.service";
import { categoryExists } from "@/lib/domain/catalog/category.service";
import { buildSearchTerms } from "@/lib/utils/searchTokens";
import { actionError, actionOk, actionValidationError, type ActionResult } from "@/lib/validation/common";
import { invalidateStorefrontCatalog } from "@/lib/cache/invalidate";
import type { Product } from "@/types/product";

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
 * `createProductAction` (T143, contracts/server-actions.md "Admin —
 * Products"): admin-only product creation. Reuses `productSchema` directly
 * — the same schema that already validates the Special Offers fields
 * (`isOnSale`/`salePrice`/`saleStartAt`/`saleEndAt`) via `withOfferRefinement`
 * — so offer fields are fully server-validated at creation time with no
 * separate schema (satisfies the deferred T329). `slug`/`searchTerms` are
 * always server-derived, never client-submitted (data-model.md); the
 * Firestore document id is server-generated, never client-chosen.
 *
 * Product images are not accepted here — a brand-new product has no id yet
 * to scope a Storage upload path to. The admin adds images on the edit page
 * immediately after creation (T148/T149).
 */
export async function createProductAction(input: unknown): Promise<ActionResult<{ productId: string }>> {
  const guardResult = await guardAdmin();
  if (guardResult) return guardResult;

  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return actionValidationError(parsed.error);
  const data = parsed.data;

  const categoryOk = await categoryExists(data.categoryId);
  if (!categoryOk) {
    return actionError("VALIDATION_ERROR", "Selected category no longer exists.", {
      categoryId: ["Selected category no longer exists."],
    });
  }

  const slug = deriveProductSlug(data.name.en);
  try {
    await assertUniqueProductSlug(slug);
  } catch {
    return actionError("CONFLICT", "A product with this name already exists.");
  }

  const searchTerms = buildSearchTerms(data.name.en, data.name.ar, data.material.en, data.material.ar);

  const ref = productsCollection().doc();
  await ref.set({
    id: ref.id,
    name: data.name,
    slug,
    description: data.description,
    price: data.price,
    categoryId: data.categoryId,
    images: [],
    material: data.material,
    options: data.options,
    stock: data.stock,
    availability: data.availability,
    isNewArrival: data.isNewArrival,
    isBestSeller: data.isBestSeller,
    salesCount: 0,
    searchTerms,
    isOnSale: data.isOnSale,
    salePrice: data.salePrice,
    saleStartAt: data.saleStartAt ? Timestamp.fromDate(data.saleStartAt) : null,
    saleEndAt: data.saleEndAt ? Timestamp.fromDate(data.saleEndAt) : null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  invalidateStorefrontCatalog();
  return actionOk({ productId: ref.id });
}

/**
 * `updateProductAction` (T144, folds in the previously-standalone
 * `updateProductOfferAction`/T328–T329 promotion management): admin-only,
 * full product edit including the Special Offers fields. Regardless of
 * which fields the submitted form included, the `salePrice < price`
 * business rule (`validateOfferInput`) is always re-checked against the
 * *effective* price/isOnSale/salePrice — falling back to the product's
 * currently-stored values for any field this submission omitted — so a
 * partial update can never leave a stale, invalid offer in place
 * (Constitution Principle 13).
 */
export async function updateProductAction(input: unknown): Promise<ActionResult<null>> {
  const guardResult = await guardAdmin();
  if (guardResult) return guardResult;

  const parsed = updateProductSchema.safeParse(input);
  if (!parsed.success) return actionValidationError(parsed.error);
  const { productId, ...rest } = parsed.data;

  const ref = productsCollection().doc(productId);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    return actionError("NOT_FOUND", "This product no longer exists.");
  }
  const current = snapshot.data()!;

  const effectivePrice = rest.price ?? current.price;
  const effectiveIsOnSale = rest.isOnSale ?? current.isOnSale;
  const effectiveSalePrice = rest.salePrice !== undefined ? rest.salePrice : current.salePrice;
  const offerError = validateOfferInput({
    isOnSale: effectiveIsOnSale,
    salePrice: effectiveSalePrice,
    price: effectivePrice,
  });
  if (offerError) {
    return actionError("VALIDATION_ERROR", offerError, { salePrice: [offerError] });
  }

  if (rest.categoryId) {
    const categoryOk = await categoryExists(rest.categoryId);
    if (!categoryOk) {
      return actionError("VALIDATION_ERROR", "Selected category no longer exists.", {
        categoryId: ["Selected category no longer exists."],
      });
    }
  }

  const mergedName = rest.name ?? current.name;
  const mergedMaterial = rest.material ?? current.material;
  const newSlug = deriveProductSlug(mergedName.en);
  if (newSlug !== current.slug) {
    try {
      await assertUniqueProductSlug(newSlug, { excludeProductId: productId });
    } catch {
      return actionError("CONFLICT", "A product with this name already exists.");
    }
  }
  const searchTerms = buildSearchTerms(mergedName.en, mergedName.ar, mergedMaterial.en, mergedMaterial.ar);

  const updatePayload: FirebaseFirestore.UpdateData<Product> = {
    name: mergedName,
    slug: newSlug,
    description: rest.description ?? current.description,
    price: effectivePrice,
    categoryId: rest.categoryId ?? current.categoryId,
    material: mergedMaterial,
    options: rest.options ?? current.options,
    stock: rest.stock ?? current.stock,
    availability: rest.availability ?? current.availability,
    isNewArrival: rest.isNewArrival ?? current.isNewArrival,
    isBestSeller: rest.isBestSeller ?? current.isBestSeller,
    searchTerms,
    isOnSale: effectiveIsOnSale,
    salePrice: effectiveSalePrice,
    saleStartAt:
      rest.saleStartAt !== undefined
        ? rest.saleStartAt
          ? Timestamp.fromDate(rest.saleStartAt)
          : null
        : current.saleStartAt,
    saleEndAt:
      rest.saleEndAt !== undefined ? (rest.saleEndAt ? Timestamp.fromDate(rest.saleEndAt) : null) : current.saleEndAt,
    updatedAt: FieldValue.serverTimestamp(),
  };

  await ref.update(updatePayload);
  invalidateStorefrontCatalog();
  return actionOk(null);
}

/**
 * `deleteProductAction` (T145): admin-only permanent product removal. Past
 * orders are unaffected — `OrderItem` snapshots (name/price/option label)
 * are immutable and never reference the live `Product` document
 * (data-model.md); a cart/wishlist line referencing the deleted id is
 * already handled as "silently absent" by `getProductsByIds` (data-model.md
 * "Cart/wishlist referential cleanup").
 */
const deleteProductInputSchema = z.object({ productId: z.string().trim().min(1, "productId is required.") });

export async function deleteProductAction(input: unknown): Promise<ActionResult<null>> {
  const guardResult = await guardAdmin();
  if (guardResult) return guardResult;

  const parsed = deleteProductInputSchema.safeParse(input);
  if (!parsed.success) return actionValidationError(parsed.error);

  await productsCollection().doc(parsed.data.productId).delete();
  invalidateStorefrontCatalog();
  return actionOk(null);
}

/**
 * `setProductFlagAction` (T146): a lightweight, single-field toggle for the
 * admin product list's inline `isNewArrival`/`isBestSeller` switches, so
 * flipping one flag doesn't require resubmitting the entire product form.
 * Deliberately does **not** include `availability` (the storefront-
 * visibility toggle) — that is a separate field handled by
 * `updateProductAction` (T144) only, per remediation finding F2, so it can
 * never be confused with, or presented alongside, the derived
 * (un-editable) Sold Out state.
 */
const setProductFlagInputSchema = z.object({
  productId: z.string().trim().min(1, "productId is required."),
  flag: z.enum(["isNewArrival", "isBestSeller"]),
  value: z.boolean(),
});

export async function setProductFlagAction(input: unknown): Promise<ActionResult<null>> {
  const guardResult = await guardAdmin();
  if (guardResult) return guardResult;

  const parsed = setProductFlagInputSchema.safeParse(input);
  if (!parsed.success) return actionValidationError(parsed.error);
  const { productId, flag, value } = parsed.data;

  const ref = productsCollection().doc(productId);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    return actionError("NOT_FOUND", "This product no longer exists.");
  }

  await ref.update({ [flag]: value, updatedAt: FieldValue.serverTimestamp() });
  invalidateStorefrontCatalog();
  return actionOk(null);
}
