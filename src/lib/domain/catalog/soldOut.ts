import type { Product } from "@/types/product";

/**
 * The single, only place "Sold Out" is computed, anywhere in this
 * codebase — never a stored field, always derived from live `stock`, so
 * the two values can never drift out of sync (Constitution Principle 10,
 * data-model.md "Sold Out derivation", spec FR-015a).
 *
 * Deliberately has NO `server-only` import (unlike the rest of
 * `lib/domain/catalog/*`) so both server code (product.service.ts) and
 * Client Components (`ProductCard`, product detail page) can import this
 * exact function — unlike a value re-exported from a `server-only`-marked
 * module, which would crash the client bundle.
 */
export function isSoldOut(product: Pick<Product, "stock">): boolean {
  return product.stock === 0;
}
