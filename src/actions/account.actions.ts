"use server";

import { FieldValue } from "firebase-admin/firestore";
import { requireUser, UnauthenticatedError } from "@/lib/firebase/guards";
import { usersCollection } from "@/lib/firebase/firestore";
import { profileSchema } from "@/lib/validation/profile.schema";
import { DELIVERY_REGION_IDS } from "@/types/deliveryRegion";
import { getOrdersForCustomer, toOrderSummary, type OrderSummary } from "@/lib/domain/orders/order.service";
import { actionError, actionOk, actionValidationError, type ActionResult } from "@/lib/validation/common";
import { z } from "zod";

/**
 * `updateProfileAction` (T134, contracts/server-actions.md "Account"):
 * requires a verified session; the `uid` written to is always the
 * verified session's own — never accepted as client input — so a
 * customer can only ever update her own `users/{uid}` document
 * (Constitution Principle 6). `email`/`role` are never touched here:
 * `email` is Firebase-Auth-owned (kept in sync only by
 * `createSessionAction`) and `role` is server-managed only.
 */
export async function updateProfileAction(input: unknown): Promise<ActionResult<null>> {
  let claims;
  try {
    claims = await requireUser();
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return actionError("UNAUTHENTICATED", "Please sign in to update your profile.");
    }
    throw err;
  }

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return actionValidationError(parsed.error);
  }

  const { name, phone, address, dateOfBirth } = parsed.data;

  // Field-level writes: a profile field the caller did not send (e.g. the
  // saved address, which the account page no longer edits) is left intact
  // rather than being overwritten by a whole-`profile` replacement.
  await usersCollection()
    .doc(claims.uid)
    .update({
      name,
      phone,
      ...(address !== undefined ? { "profile.address": address } : {}),
      ...(dateOfBirth !== undefined ? { "profile.dateOfBirth": dateOfBirth } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    });

  return actionOk(null);
}

const syncLocationSelectionSchema = z.object({
  regionId: z.enum(DELIVERY_REGION_IDS),
  locationId: z.string().trim().min(1),
});

/**
 * `syncLocationSelectionAction` (T275, spec FR-090): when a signed-in
 * customer picks a location from the navbar `LocationSelector`, keep her
 * saved profile address's `regionId`/`locationId` in sync — but only if
 * she already has a saved address. This deliberately does **not** reuse
 * `updateProfileAction`/`profileSchema`, which requires a full
 * `addressLine` — the navbar selector is a quick region/city picker, not
 * a full address form, so it would be poor UX to force one to be entered
 * just to change delivery location from the navbar. A guest, or a
 * customer with no saved address yet, has nothing to sync into; her
 * selection still persists via the cookie (T271) and is still fully
 * re-validated at checkout (T277) regardless.
 */
export async function syncLocationSelectionAction(input: unknown): Promise<ActionResult<null>> {
  let claims;
  try {
    claims = await requireUser();
  } catch {
    return actionOk(null); // not signed in — cookie persistence alone is enough
  }

  const parsed = syncLocationSelectionSchema.safeParse(input);
  if (!parsed.success) return actionValidationError(parsed.error);

  const ref = usersCollection().doc(claims.uid);
  const snapshot = await ref.get();
  const existingAddress = snapshot.data()?.profile?.address;
  if (!existingAddress) return actionOk(null); // nothing saved yet — cookie persistence alone is enough

  await ref.update({
    "profile.address.regionId": parsed.data.regionId,
    "profile.address.locationId": parsed.data.locationId,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return actionOk(null);
}

/**
 * Thin, serializable read wrapper around `getOrdersForCustomer` for the
 * order-history page's "Load More" control — mirrors
 * `loadMoreProductsAction` (catalog.actions.ts). Always scoped to the
 * verified session's own `uid`, never a client-supplied one.
 */
export async function loadMoreOrdersAction(
  cursorId: string | null,
): Promise<{ orders: OrderSummary[]; nextCursorId: string | null }> {
  let claims;
  try {
    claims = await requireUser();
  } catch {
    return { orders: [], nextCursorId: null };
  }

  const { orders, nextCursorId } = await getOrdersForCustomer(claims.uid, { cursorId });
  return { orders: orders.map(toOrderSummary), nextCursorId };
}
