"use server";

import { FieldValue } from "firebase-admin/firestore";
import { deliveryRegionsCollection, deliveryLocationsCollection } from "@/lib/firebase/firestore";
import { ForbiddenError, requireAdmin, UnauthenticatedError } from "@/lib/firebase/guards";
import { updateDeliveryRegionSchema } from "@/lib/validation/deliveryRegion.schema";
import {
  deliveryLocationSchema,
  updateDeliveryLocationSchema,
  deleteDeliveryLocationSchema,
} from "@/lib/validation/deliveryLocation.schema";
import {
  assertValidDeliveryRegionId,
  assertUniqueDeliveryLocationSlug,
  deriveDeliveryLocationSlug,
  buildDeliveryLocationSearchTerms,
} from "@/lib/domain/delivery/deliveryLocation.service";
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
 * `updateDeliveryRegionAction` (T282, spec FR-086): admin-only. Updates an
 * **existing** `deliveryRegions/{regionId}` document's bilingual
 * `name`/`isActive`/`displayOrder` only — this action never creates or
 * deletes a region; the two regions are fixed at seed time
 * (`scripts/seed.ts`) and `assertValidDeliveryRegionId` rejects any
 * `regionId` outside the two fixed values before this ever reaches
 * Firestore, regardless of what the schema already caught.
 */
export async function updateDeliveryRegionAction(input: unknown): Promise<ActionResult<null>> {
  const guardResult = await guardAdmin();
  if (guardResult) return guardResult;

  const parsed = updateDeliveryRegionSchema.safeParse(input);
  if (!parsed.success) return actionValidationError(parsed.error);
  const { regionId, ...rest } = parsed.data;

  assertValidDeliveryRegionId(regionId);

  const ref = deliveryRegionsCollection().doc(regionId);
  const snapshot = await ref.get();
  if (!snapshot.exists) return actionError("NOT_FOUND", "This region no longer exists.");
  const current = snapshot.data()!;

  await ref.update({
    name: rest.name ?? current.name,
    displayOrder: rest.displayOrder ?? current.displayOrder,
    isActive: rest.isActive ?? current.isActive,
    updatedAt: FieldValue.serverTimestamp(),
  });

  invalidateStorefrontCatalog();
  return actionOk(null);
}

/**
 * `createDeliveryLocationAction` (T283, spec FR-089): admin-only creation
 * of a new city/area within one of the two fixed regions. `slug`/
 * `searchTerms` are always server-derived, never client-submitted
 * (mirrors `createProductAction`); uniqueness is checked per-region, not
 * globally (data-model.md).
 */
export async function createDeliveryLocationAction(input: unknown): Promise<ActionResult<{ locationId: string }>> {
  const guardResult = await guardAdmin();
  if (guardResult) return guardResult;

  const parsed = deliveryLocationSchema.safeParse(input);
  if (!parsed.success) return actionValidationError(parsed.error);
  const data = parsed.data;

  const slug = deriveDeliveryLocationSlug(data.name.en);
  try {
    await assertUniqueDeliveryLocationSlug(data.regionId, slug);
  } catch {
    return actionError("CONFLICT", "A location with this name already exists in this region.");
  }

  const searchTerms = buildDeliveryLocationSearchTerms(data.name.en, data.name.ar);

  const ref = deliveryLocationsCollection().doc();
  await ref.set({
    id: ref.id,
    regionId: data.regionId,
    name: data.name,
    slug,
    searchTerms,
    displayOrder: data.displayOrder,
    isActive: data.isActive,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  invalidateStorefrontCatalog();
  return actionOk({ locationId: ref.id });
}

/**
 * `updateDeliveryLocationAction` (T283): admin-only edit of an existing
 * location's bilingual name, `isActive`, and/or `displayOrder`. `regionId`
 * is never editable here (a location doesn't move between regions —
 * delete and recreate it in the other region instead, which also keeps
 * any historical order's bilingual delivery snapshot, T280, untouched
 * either way). `slug`/`searchTerms` are re-derived only when `name.en`
 * actually changes.
 */
export async function updateDeliveryLocationAction(input: unknown): Promise<ActionResult<null>> {
  const guardResult = await guardAdmin();
  if (guardResult) return guardResult;

  const parsed = updateDeliveryLocationSchema.safeParse(input);
  if (!parsed.success) return actionValidationError(parsed.error);
  const { locationId, ...rest } = parsed.data;

  const ref = deliveryLocationsCollection().doc(locationId);
  const snapshot = await ref.get();
  if (!snapshot.exists) return actionError("NOT_FOUND", "This location no longer exists.");
  const current = snapshot.data()!;

  let slug = current.slug;
  let searchTerms = current.searchTerms;
  if (rest.name && rest.name.en !== current.name.en) {
    const newSlug = deriveDeliveryLocationSlug(rest.name.en);
    if (newSlug !== current.slug) {
      try {
        await assertUniqueDeliveryLocationSlug(current.regionId, newSlug, { excludeLocationId: locationId });
      } catch {
        return actionError("CONFLICT", "A location with this name already exists in this region.");
      }
      slug = newSlug;
    }
    searchTerms = buildDeliveryLocationSearchTerms(rest.name.en, rest.name.ar ?? null);
  }

  await ref.update({
    name: rest.name ?? current.name,
    slug,
    searchTerms,
    displayOrder: rest.displayOrder ?? current.displayOrder,
    isActive: rest.isActive ?? current.isActive,
    updatedAt: FieldValue.serverTimestamp(),
  });

  invalidateStorefrontCatalog();
  return actionOk(null);
}

/**
 * `deleteDeliveryLocationAction` (T283): admin-only permanent removal.
 * Never touches a historical order's bilingual delivery snapshot (T280,
 * an immutable copy captured at order-creation time, not a live
 * reference) — admins are encouraged to deactivate a location instead of
 * deleting it, since deleting removes it from the admin list entirely
 * with no way to see it was ever offered, whereas deactivating keeps that
 * history visible.
 */
export async function deleteDeliveryLocationAction(input: unknown): Promise<ActionResult<null>> {
  const guardResult = await guardAdmin();
  if (guardResult) return guardResult;

  const parsed = deleteDeliveryLocationSchema.safeParse(input);
  if (!parsed.success) return actionValidationError(parsed.error);

  await deliveryLocationsCollection().doc(parsed.data.locationId).delete();
  invalidateStorefrontCatalog();
  return actionOk(null);
}
