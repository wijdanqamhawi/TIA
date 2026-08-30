import "server-only";
import { productsCollection } from "@/lib/firebase/firestore";
import { validateCartLineAvailability } from "@/lib/domain/catalog/product.service";
import { resolveOfferPricing } from "@/lib/domain/catalog/offer";
import type { OrderLine } from "@/lib/domain/orders/order.service";

export type OrderLineValidationResult = {
  productId: string;
  ok: boolean;
  reason?: "NOT_FOUND" | "NOT_AVAILABLE" | "SOLD_OUT" | "INSUFFICIENT_STOCK" | "INVALID_QUANTITY";
};

/**
 * Authoritative stale-cart re-validation (spec FR-026): re-reads every
 * line's product fresh from Firestore and re-checks availability/Sold Out/
 * stock — never trusts whatever the cart, session, or client last
 * displayed. Gives a clear per-line error before Phase 8's checkout even
 * attempts the order-creation transaction; that transaction's own
 * `transaction.get()` re-read (`decrementStockForOrder`) remains the
 * final, race-free authority — this is a pre-check, not a substitute.
 */
export async function validateOrderLines(lines: OrderLine[]): Promise<OrderLineValidationResult[]> {
  const results: OrderLineValidationResult[] = [];

  for (const line of lines) {
    const snapshot = await productsCollection().doc(line.productId).get();

    if (!snapshot.exists) {
      results.push({ productId: line.productId, ok: false, reason: "NOT_FOUND" });
      continue;
    }

    const validation = validateCartLineAvailability(snapshot.data()!, line.quantity);
    results.push({
      productId: line.productId,
      ok: validation.ok,
      reason: validation.ok ? undefined : validation.reason,
    });
  }

  return results;
}

export type PricedOrderLine = { productId: string; quantity: number; unitPrice: number };

/**
 * Resolves each line's authoritative **effective** unit price (regular or
 * currently-`ACTIVE` sale price) from a fresh Firestore read — the same
 * `resolveOfferPricing` derivation `buildCartSummary` (Phase 6) already
 * uses — never a client-submitted or cart-cached price (spec FR-119,
 * SC-029). `Sold Out`/availability are validated separately by
 * `validateOrderLines` above and always take priority over any offer
 * state (spec FR-122); a line already excluded there is simply skipped
 * here rather than priced.
 *
 * This is a pre-built primitive for Phase 8's full order-creation
 * transaction (tasks.md T123/T326), which will call this same logic
 * *inside* its own transaction (re-reading each product via
 * `transaction.get()`, exactly as `decrementStockForOrder` already does)
 * immediately before building the immutable `OrderItem` price snapshot —
 * mirroring the established pattern of pre-building order-creation
 * primitives ahead of their phase (`order.service.ts`
 * `decrementStockForOrder`/`restockForCancellation`).
 */
export async function resolveOrderLinePrices(lines: OrderLine[]): Promise<PricedOrderLine[]> {
  const results: PricedOrderLine[] = [];

  for (const line of lines) {
    const snapshot = await productsCollection().doc(line.productId).get();
    if (!snapshot.exists) continue;

    const { effectivePrice } = resolveOfferPricing(snapshot.data()!);
    results.push({ productId: line.productId, quantity: line.quantity, unitPrice: effectivePrice });
  }

  return results;
}
