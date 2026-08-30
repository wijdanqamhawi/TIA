"use server";

import { getAdminFirestore } from "@/lib/firebase/firestore";
import { getSessionClaims } from "@/lib/firebase/guards";
import { resolveCartRefForMutation } from "@/lib/domain/cart/cart.service";
import { createOrder } from "@/lib/domain/orders/order.service";
import { grantGuestOrderAccess } from "@/lib/domain/orders/guest-order-access";
import { getActiveDeliveryLocationsByRegion } from "@/lib/domain/delivery/deliveryLocation.service";
import { resolvePaymentMethod } from "@/lib/domain/checkout/payment";
import { checkoutSchema } from "@/lib/validation/checkout.schema";
import { isDeliveryRegionId, type DeliveryRegionId } from "@/types/deliveryRegion";
import { actionError, actionOk, actionValidationError, type ActionResult } from "@/lib/validation/common";
import { rateLimit } from "@/lib/utils/rate-limit";
import { getClientIp } from "@/lib/utils/request-ip";

/** Serializable subset of `DeliveryLocation` — strips `createdAt`/`updatedAt` `Timestamp`s, which cannot cross into a Client Component. */
export type DeliveryLocationOption = { id: string; name: { en: string; ar: string | null }; slug: string };

/**
 * `submitCheckoutAction` (T124, contracts/server-actions.md "Checkout /
 * Orders"): validates the checkout form, resolves the caller's cart
 * (guest or registered — never requiring sign-in, spec: guest checkout
 * supported), and delegates to the single order-creation transaction
 * (`createOrder`). Never trusts client-submitted price/stock/promotional/
 * delivery-eligibility data — every one of those is re-derived inside the
 * transaction from a fresh Firestore read.
 *
 * Rate-limited per client IP (T230, research.md §13) as a defense-in-depth
 * backstop against order-creation abuse (e.g. scripted checkout spam) —
 * never the sole protection, since every order is still fully
 * re-validated inside `createOrder`'s transaction regardless.
 */
export async function submitCheckoutAction(input: unknown): Promise<ActionResult<{ orderNumber: string }>> {
  const ip = await getClientIp();
  if (!rateLimit(`checkout:${ip}`, 20, 60 * 1000).allowed) {
    return actionError("RATE_LIMITED", "Too many checkout attempts. Please wait a moment and try again.");
  }

  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return actionValidationError(parsed.error);
  }

  const paymentMethod = resolvePaymentMethod(parsed.data.paymentMethod);
  if (!paymentMethod) {
    return actionError("INVALID_PAYMENT_METHOD", "The selected payment method is not available.");
  }

  const claims = await getSessionClaims();
  const { ref: cartRef } = await resolveCartRefForMutation();

  const result = await createOrder(getAdminFirestore(), {
    uid: claims?.uid ?? null,
    cartRef,
    checkout: parsed.data,
    paymentMethodType: paymentMethod.type,
  });

  if (!result.ok) {
    const fieldErrors: Record<string, string[]> | undefined = result.error.productId
      ? { productId: [result.error.productId] }
      : result.error.code === "LOCATION_NOT_SUPPORTED"
        ? { locationId: [result.error.message] }
        : undefined;
    return actionError(result.error.code, result.error.message, fieldErrors);
  }

  // Guests need a way to view their own confirmation page without an
  // account (spec: guest checkout) but must never be able to view another
  // guest's order by guessing a sequential order number — grant access
  // scoped to exactly this order number (`guest-order-access.ts`).
  if (!claims) {
    await grantGuestOrderAccess(result.orderNumber);
  }

  return actionOk({ orderNumber: result.orderNumber });
}

/**
 * Thin read wrapper for the checkout form's city/area selector: given a
 * chosen region, returns its active locations. A Server Action (rather
 * than a client Firestore SDK read) so the read still goes through the
 * Admin SDK server-side (Constitution Principle 7) while letting the
 * checkout form repopulate the city dropdown without a full page reload
 * when the shopper changes region.
 */
export async function getDeliveryLocationsForRegionAction(regionId: string): Promise<DeliveryLocationOption[]> {
  if (!isDeliveryRegionId(regionId)) return [];
  const locations = await getActiveDeliveryLocationsByRegion(regionId as DeliveryRegionId);
  return locations.map((location) => ({ id: location.id, name: location.name, slug: location.slug }));
}
