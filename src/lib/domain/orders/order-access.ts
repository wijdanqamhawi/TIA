import type { Order } from "@/types/order";
import type { SessionClaims } from "@/lib/firebase/auth";

export type OrderAccessDecision =
  | { allowed: true; isOwner: boolean }
  | { allowed: false; reason: "no_session" | "not_owner" | "guest_order_no_access" };

/**
 * Who may view `/order-confirmation/[orderNumber]`. Pure so every branch is
 * testable. Only the signed-in owner (`claims.uid === order.userId`) or the
 * holder of the signed guest-order cookie for a guest order is allowed — there
 * is deliberately no role-based (admin) bypass; admins use the admin order pages.
 *
 * The `reason` is for server-side diagnostics only; the page renders the same
 * 404 for every denial so a caller can never learn whether an order exists.
 */
export function decideOrderAccess(
  order: Pick<Order, "userId">,
  claims: Pick<SessionClaims, "uid"> | null,
  hasGuestAccess: boolean,
): OrderAccessDecision {
  if (claims && order.userId && order.userId === claims.uid) {
    return { allowed: true, isOwner: true };
  }
  if (!order.userId) {
    return hasGuestAccess ? { allowed: true, isOwner: false } : { allowed: false, reason: "guest_order_no_access" };
  }
  return { allowed: false, reason: claims ? "not_owner" : "no_session" };
}
