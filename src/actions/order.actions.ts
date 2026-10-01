"use server";

import { getAdminFirestore } from "@/lib/firebase/firestore";
import { getSessionClaims } from "@/lib/firebase/guards";
import { editCustomerOrder } from "@/lib/domain/orders/order-edit.service";
import { orderEditSchema } from "@/lib/validation/order-edit.schema";
import {
  actionError,
  actionOk,
  actionValidationError,
  type ActionResult,
} from "@/lib/validation/common";
import { rateLimit } from "@/lib/utils/rate-limit";

/**
 * `updateCustomerOrderAction`: a signed-in customer edits their OWN order (quantities, removals,
 * phone, delivery, notes). The uid comes from the verified session — never the client — and the
 * order's status, ownership, stock and prices are all decided inside `editCustomerOrder`'s
 * transaction. The error `code` is translated by the form; no internal detail is returned.
 */
export async function updateCustomerOrderAction(
  input: unknown,
): Promise<ActionResult<{ orderNumber: string; total: number }>> {
  const claims = await getSessionClaims();
  if (!claims) return actionError("UNAUTHENTICATED", "Please sign in to edit your order.");

  if (!rateLimit(`order-edit:${claims.uid}`, 20, 60 * 1000).allowed) {
    return actionError("RATE_LIMITED", "Too many attempts. Please wait a moment and try again.");
  }

  const parsed = orderEditSchema.safeParse(input);
  if (!parsed.success) return actionValidationError(parsed.error);

  const result = await editCustomerOrder(getAdminFirestore(), claims.uid, parsed.data);
  if (!result.ok) {
    const fieldErrors = result.error.productId
      ? { productId: [result.error.productId] }
      : undefined;
    return actionError(result.error.code, result.error.code, fieldErrors);
  }
  return actionOk({ orderNumber: result.orderNumber, total: result.total });
}
