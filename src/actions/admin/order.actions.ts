"use server";

import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { ForbiddenError, requireAdmin, UnauthenticatedError } from "@/lib/firebase/guards";
import { transitionOrderStatus } from "@/lib/domain/orders/order-status.service";
import { ORDER_STATUSES } from "@/types/order";
import { actionError, actionOk, actionValidationError, type ActionResult } from "@/lib/validation/common";

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

const updateOrderStatusInputSchema = z.object({
  orderId: z.string().trim().min(1, "orderId is required."),
  status: z.enum(ORDER_STATUSES),
});

/**
 * `updateOrderStatusAction` (T163, spec User Story 3): admin-only secure
 * order-status transition. All the actual integrity work (state-machine
 * validation, restock-on-cancel) happens inside `transitionOrderStatus`'s
 * single Firestore transaction (T162) — this action is only the
 * authorization boundary and input shape check.
 */
export async function updateOrderStatusAction(input: unknown): Promise<ActionResult<null>> {
  const guardResult = await guardAdmin();
  if (guardResult) return guardResult;

  const parsed = updateOrderStatusInputSchema.safeParse(input);
  if (!parsed.success) return actionValidationError(parsed.error);

  const result = await transitionOrderStatus(getAdminFirestore(), parsed.data.orderId, parsed.data.status);
  if (!result.ok) {
    return actionError(result.error.code, result.error.message);
  }
  return actionOk(null);
}
