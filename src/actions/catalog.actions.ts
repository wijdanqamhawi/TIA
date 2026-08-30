"use server";

import {
  listProducts,
  toProductCardData,
  type ListProductsParams,
  type ProductCardData,
} from "@/lib/domain/catalog/product.service";
import { getWishlistedProductIds } from "@/lib/domain/wishlist/wishlist.service";

export type LoadMoreProductsResult = {
  products: ProductCardData[];
  nextCursorId: string | null;
};

/**
 * Thin read wrapper around `listProducts` (research.md §17) for the Shop/
 * category pages' "Load More" control — cursor-based pagination via a
 * Server Action so results append client-side without a full page
 * navigation, while every read still goes through the Admin SDK
 * server-side (Constitution Principle 7). Returns only `ProductCardData`
 * — a Firestore `Timestamp` (`createdAt`/`updatedAt`) isn't a plain
 * serializable value a Server Action can return to a Client Component.
 */
export async function loadMoreProductsAction(params: ListProductsParams): Promise<LoadMoreProductsResult> {
  const [{ products, nextCursorId }, wishlistedProductIds] = await Promise.all([
    listProducts(params),
    getWishlistedProductIds(),
  ]);
  return { products: products.map((product) => toProductCardData(product, wishlistedProductIds)), nextCursorId };
}
