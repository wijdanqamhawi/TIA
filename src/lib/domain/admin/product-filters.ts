import type { OfferStatus } from "@/lib/domain/catalog/offer";

export type AdminProductStockFilter = "all" | "inStock" | "soldOut";
export type AdminProductStatusFilter =
  "all" | "visible" | "hidden" | "newArrival" | "bestSeller" | "onSale";

export type AdminProductFilters = {
  query: string;
  categoryId: string;
  stock: AdminProductStockFilter;
  status: AdminProductStatusFilter;
};

type FilterableProduct = {
  nameEn: string;
  nameAr: string | null;
  categoryId: string;
  isSoldOut: boolean;
  availability: boolean;
  isNewArrival: boolean;
  isBestSeller: boolean;
  offerStatus: OfferStatus;
};

/**
 * The admin product list's client-side filters (T150): a case-insensitive
 * name search over both languages, plus category, stock and status. "On
 * Sale" means a currently *active* offer, the same meaning as the list's
 * offer pill and the Special Offers count.
 */
export function filterAdminProducts<T extends FilterableProduct>(
  products: T[],
  filters: AdminProductFilters,
): T[] {
  const q = filters.query.trim().toLowerCase();
  return products.filter((product) => {
    if (
      q &&
      !product.nameEn.toLowerCase().includes(q) &&
      !product.nameAr?.toLowerCase().includes(q)
    )
      return false;
    if (filters.categoryId !== "all" && product.categoryId !== filters.categoryId) return false;
    if (filters.stock === "inStock" && product.isSoldOut) return false;
    if (filters.stock === "soldOut" && !product.isSoldOut) return false;
    switch (filters.status) {
      case "visible":
        return product.availability;
      case "hidden":
        return !product.availability;
      case "newArrival":
        return product.isNewArrival;
      case "bestSeller":
        return product.isBestSeller;
      case "onSale":
        return product.offerStatus === "ACTIVE";
      default:
        return true;
    }
  });
}
