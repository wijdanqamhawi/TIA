import "server-only";
import { categoryShowcasesCollection, productsCollection } from "@/lib/firebase/firestore";
import type { Product } from "@/types/product";
import type { CategoryShowcase } from "@/types/categoryShowcase";

const FEATURED_PRODUCTS_LIMIT = 8;

/**
 * The homepage's "Featured {Category}" strip query (data-model.md
 * `categoryShowcases` "Relationships", spec FR-001b): a live query, never
 * denormalized onto the showcase document, so it can never leak another
 * category's products or go stale relative to the real catalog. Filters
 * only on `availability` — never on `stock` — so a Sold Out product still
 * appears here exactly as it would anywhere else in the catalog (spec
 * FR-015a, FR-001c); Sold Out badge rendering is added in Phase 5.
 */
export async function getFeaturedProductsForCategory(
  categoryId: string,
  limit = FEATURED_PRODUCTS_LIMIT,
): Promise<Product[]> {
  const snapshot = await productsCollection()
    .where("categoryId", "==", categoryId)
    .where("availability", "==", true)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => doc.data());
}

/**
 * Active homepage category showcases, ordered for rendering (Home page
 * assembly, T068) — Hero → Bracelets → Rings → Earrings → Watches →
 * remaining sections (spec FR-001).
 */
export async function getActiveCategoryShowcases(): Promise<CategoryShowcase[]> {
  const snapshot = await categoryShowcasesCollection()
    .where("isActive", "==", true)
    .orderBy("displayOrder", "asc")
    .get();

  return snapshot.docs.map((doc) => doc.data());
}

/** Every category showcase regardless of `isActive`, for admin management (T160). */
export async function getAllCategoryShowcases(): Promise<CategoryShowcase[]> {
  const snapshot = await categoryShowcasesCollection().orderBy("displayOrder", "asc").get();
  return snapshot.docs.map((doc) => doc.data());
}
