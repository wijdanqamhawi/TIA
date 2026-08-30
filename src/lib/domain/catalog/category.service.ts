import "server-only";
import { categoriesCollection } from "@/lib/firebase/firestore";
import type { Category } from "@/types/category";

/**
 * Verifies `categoryId` references a real `categories/{categoryId}`
 * document. Called from product/showcase create/update (spec FR-007d) —
 * never trusted from the client form, since an admin form's category
 * dropdown value is still just client-supplied text until this check
 * confirms it server-side (Constitution Principle 13).
 */
export async function getCategoryOrThrow(categoryId: string): Promise<Category> {
  const snapshot = await categoriesCollection().doc(categoryId).get();

  if (!snapshot.exists) {
    throw new Error(`Unknown categoryId: ${categoryId}`);
  }

  return snapshot.data() as Category;
}

export async function categoryExists(categoryId: string): Promise<boolean> {
  const snapshot = await categoriesCollection().doc(categoryId).get();
  return snapshot.exists;
}

/**
 * Active categories, ordered for rendering (Navbar quick-links, Featured
 * Categories, Shop-page switcher). Reads live Firestore data — the
 * category list is never hardcoded into a UI component (spec FR-046a).
 */
export async function getActiveCategories(): Promise<Category[]> {
  const snapshot = await categoriesCollection()
    .where("isActive", "==", true)
    .orderBy("displayOrder", "asc")
    .get();

  return snapshot.docs.map((doc) => doc.data());
}

/** Every category regardless of `isActive`, for admin management (T156) — unlike `getActiveCategories`, an admin must be able to see and re-enable a hidden category. */
export async function getAllCategories(): Promise<Category[]> {
  const snapshot = await categoriesCollection().orderBy("displayOrder", "asc").get();
  return snapshot.docs.map((doc) => doc.data());
}

/** A single active category by its language-independent slug, or null. */
export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const snapshot = await categoriesCollection()
    .where("slug", "==", slug)
    .where("isActive", "==", true)
    .limit(1)
    .get();

  return snapshot.empty ? null : snapshot.docs[0].data();
}
