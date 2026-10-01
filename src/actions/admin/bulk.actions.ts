"use server";

import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/firestore";
import { ForbiddenError, requireAdmin, UnauthenticatedError } from "@/lib/firebase/guards";
import {
  deleteAllProducts,
  removeAllOffers,
  type BulkResult,
} from "@/lib/domain/admin/bulk.service";
import { invalidateStorefrontCatalog } from "@/lib/cache/invalidate";
import {
  actionError,
  actionOk,
  actionValidationError,
  type ActionResult,
} from "@/lib/validation/common";

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

const bulkInputSchema = z.object({
  /** The record count the admin saw in the confirmation dialog — a stale-UI guard, never a filter. */
  expectedCount: z.number().int().min(1).max(100000),
});

/** `imagesDeleted` / `imagesFailed` are set by Delete All products only. */
export type BulkActionData = { count: number; imagesDeleted?: number; imagesFailed?: number };

/**
 * Turns the service outcome into the action result the UI understands. A failure carries how many
 * records were already done / still remain (`fieldErrors.done` / `fieldErrors.remaining`), so a partial
 * failure is reported honestly instead of as a generic error.
 */
async function run(
  input: unknown,
  operation: (expectedCount: number) => Promise<BulkResult>,
): Promise<ActionResult<BulkActionData>> {
  const guardResult = await guardAdmin();
  if (guardResult) return guardResult;

  const parsed = bulkInputSchema.safeParse(input);
  if (!parsed.success) return actionValidationError(parsed.error);

  const result = await operation(parsed.data.expectedCount);
  if (result.ok) {
    if (result.count > 0) invalidateStorefrontCatalog();
    return actionOk({
      count: result.count,
      ...(result.images
        ? { imagesDeleted: result.images.deleted, imagesFailed: result.images.failed }
        : {}),
    });
  }
  // A partial run changed the catalog too.
  if (result.done > 0) invalidateStorefrontCatalog();
  return actionError(result.code, result.code, {
    done: [String(result.done)],
    remaining: [String(result.remaining)],
    ...(result.images ? { imagesFailed: [String(result.images.failed)] } : {}),
  });
}

/**
 * `deleteAllProductsAction`: permanently deletes every product (admin-only, same guard as the existing
 * single `deleteProductAction`). Orders, customers, categories and showcases are untouched.
 */
export async function deleteAllProductsAction(
  input: unknown,
): Promise<ActionResult<BulkActionData>> {
  return run(input, (expectedCount) => deleteAllProducts(getAdminFirestore(), expectedCount));
}

/**
 * `removeAllOffersAction`: clears every product's Special Offer fields. The products are NOT deleted.
 */
export async function removeAllOffersAction(input: unknown): Promise<ActionResult<BulkActionData>> {
  return run(input, (expectedCount) => removeAllOffers(getAdminFirestore(), expectedCount));
}
