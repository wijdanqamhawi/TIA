import { Timestamp } from "firebase-admin/firestore";
import type { Product } from "@/types/product";

/**
 * The single, only place offer status / effective price is computed,
 * anywhere in this codebase — never a stored field, always derived from
 * `isOnSale`/`salePrice`/`saleStartAt`/`saleEndAt` and the current time, so
 * it can never drift out of sync (Constitution Principle 10, mirrors
 * `soldOut.ts`; data-model.md "Offer status derivation", spec FR-115).
 *
 * Deliberately has NO `server-only` import (unlike the rest of
 * `lib/domain/catalog/*`) so both server code and Client Components
 * (ProductCard, QuickView, product detail page, Cart) can import this exact
 * function.
 */

export type OfferStatus = "DISABLED" | "SCHEDULED" | "ACTIVE" | "EXPIRED";

type OfferFields = Pick<Product, "isOnSale" | "salePrice" | "saleStartAt" | "saleEndAt">;

export function getOfferStatus(product: OfferFields, now: Timestamp): OfferStatus {
  if (!product.isOnSale || product.salePrice == null) return "DISABLED";
  if (product.saleStartAt && now.toMillis() < product.saleStartAt.toMillis()) return "SCHEDULED";
  if (product.saleEndAt && now.toMillis() >= product.saleEndAt.toMillis()) return "EXPIRED";
  return "ACTIVE";
}

export function getEffectivePrice(product: OfferFields & Pick<Product, "price">, now: Timestamp): number {
  return getOfferStatus(product, now) === "ACTIVE" ? product.salePrice! : product.price;
}

/**
 * Convenience wrapper for production call sites that just need "the offer
 * status and effective price right now" and don't need to control `now`
 * for determinism (unlike the unit tests for `getOfferStatus`/
 * `getEffectivePrice` above, which pass a fixed instant).
 */
export function resolveOfferPricing(
  product: OfferFields & Pick<Product, "price">,
): { offerStatus: OfferStatus; effectivePrice: number } {
  const now = Timestamp.now();
  return { offerStatus: getOfferStatus(product, now), effectivePrice: getEffectivePrice(product, now) };
}

/**
 * The single place the `salePrice < price` / `salePrice` required-while-
 * enabled business rule is expressed (spec FR-114, SC-027) — shared by the
 * `productSchema` Zod refinement (`lib/validation/product.schema.ts`) and
 * the admin offer-management Server Action, so the two can never drift
 * apart. Returns a human-readable error message, or `null` if valid.
 */
export function validateOfferInput(input: {
  isOnSale: boolean;
  salePrice: number | null;
  price: number;
}): string | null {
  if (input.isOnSale && (input.salePrice == null || input.salePrice <= 0)) {
    return "A sale price greater than 0 is required while the offer is enabled.";
  }
  if (input.salePrice != null && input.salePrice >= input.price) {
    return "Sale price must be lower than the regular price.";
  }
  return null;
}
