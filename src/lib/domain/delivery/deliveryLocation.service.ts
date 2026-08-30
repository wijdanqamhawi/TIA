import "server-only";
import type { Transaction } from "firebase-admin/firestore";
import { deliveryRegionsCollection, deliveryLocationsCollection } from "@/lib/firebase/firestore";
import { slugify } from "@/lib/utils/slugify";
import { buildSearchTerms } from "@/lib/utils/searchTokens";
import { DELIVERY_REGION_IDS, isDeliveryRegionId } from "@/types/deliveryRegion";
import type { DeliveryRegion } from "@/types/deliveryRegion";
import type { DeliveryLocation } from "@/types/deliveryLocation";
import type { DeliveryRegionId } from "@/types/deliveryRegion";

/** The two fixed regions, active ones only, for the checkout region selector. */
export async function getActiveDeliveryRegions(): Promise<DeliveryRegion[]> {
  const snapshot = await deliveryRegionsCollection()
    .where("isActive", "==", true)
    .orderBy("displayOrder", "asc")
    .get();
  return snapshot.docs.map((doc) => doc.data());
}

/** Active cities/areas within one region, for the checkout city/area selector. */
export async function getActiveDeliveryLocationsByRegion(regionId: DeliveryRegionId): Promise<DeliveryLocation[]> {
  const snapshot = await deliveryLocationsCollection()
    .where("regionId", "==", regionId)
    .where("isActive", "==", true)
    .orderBy("displayOrder", "asc")
    .get();
  return snapshot.docs.map((doc) => doc.data());
}

/** Every region regardless of active state, for `/admin/locations` (T284). */
export async function getAllDeliveryRegions(): Promise<DeliveryRegion[]> {
  const snapshot = await deliveryRegionsCollection().orderBy("displayOrder", "asc").get();
  return snapshot.docs.map((doc) => doc.data());
}

/** Every location within one region regardless of active state, for `/admin/locations` (T284). */
export async function getAllDeliveryLocationsByRegion(regionId: DeliveryRegionId): Promise<DeliveryLocation[]> {
  const snapshot = await deliveryLocationsCollection()
    .where("regionId", "==", regionId)
    .orderBy("displayOrder", "asc")
    .get();
  return snapshot.docs.map((doc) => doc.data());
}

// --- Admin management (T265, T266, T282–T283) ---

/**
 * The two fixed regions MUST always be `west-bank`/`inside-1948` — never a
 * fresh/auto-generated value (research.md §40). Both the admin
 * region-update action (T282) and any other write path touching a
 * `regionId` call this before writing, so a mistyped/invented region can
 * never be persisted regardless of caller.
 */
export function assertValidDeliveryRegionId(regionId: string): asserts regionId is DeliveryRegionId {
  if (!isDeliveryRegionId(regionId)) {
    throw new Error(
      `"${regionId}" is not a valid delivery region. Must be one of: ${DELIVERY_REGION_IDS.join(", ")}.`,
    );
  }
}

export function deriveDeliveryLocationSlug(nameEn: string): string {
  return slugify(nameEn);
}

export function buildDeliveryLocationSearchTerms(nameEn: string, nameAr: string | null): string[] {
  return buildSearchTerms(nameEn, nameAr);
}

/**
 * Transactional per-region slug-uniqueness check (T265, read-check-then-
 * write, data-model.md "Uniqueness without unique indexes") — mirrors
 * `assertUniqueProductSlug` exactly, except scoped to `regionId` since a
 * location's slug only needs to be unique **within its own region**, not
 * globally (two regions may legitimately each have a city that slugifies
 * to the same value).
 */
export async function assertUniqueDeliveryLocationSlug(
  regionId: DeliveryRegionId,
  slug: string,
  options?: { excludeLocationId?: string; transaction?: Transaction },
): Promise<void> {
  const query = deliveryLocationsCollection().where("regionId", "==", regionId).where("slug", "==", slug).limit(1);
  const snapshot = options?.transaction ? await options.transaction.get(query) : await query.get();

  const conflict = snapshot.docs.find((doc) => doc.id !== options?.excludeLocationId);
  if (conflict) {
    throw new Error(`A location with slug "${slug}" already exists in this region.`);
  }
}
