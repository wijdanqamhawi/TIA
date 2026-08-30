import { beforeAll, describe, expect, it } from "vitest";

/**
 * Requires the Firebase Local Emulator Suite (Firestore) running, with
 * FIRESTORE_EMULATOR_HOST set in the environment (research.md §14) —
 * e.g. `firebase emulators:exec "npm run test:integration"`, or start the
 * emulators separately (`npm run emulators`) and export
 * FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 before running this suite.
 * Skipped automatically when that env var isn't set, so `npm run
 * test:unit` never needs the emulator running.
 */
const hasEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

describe.skipIf(!hasEmulator)("catalog seed (Firebase Local Emulator Suite)", () => {
  const CATEGORY_IDS = ["bracelets", "rings", "earrings", "watches"];

  beforeAll(async () => {
    const { seedAll } = await import("../../scripts/seed");
    await seedAll();
    // `seedAll` performs ~21 sequential Admin SDK writes (categories,
    // showcases, products, delivery regions/locations); on a slower disk/
    // emulator this legitimately exceeds Vitest's default 10s hook budget
    // even though nothing is actually hung — a longer, explicit timeout
    // for this specific hook, not a global relaxation.
  }, 30000);

  it("seeds all four core categories, active and correctly ordered", async () => {
    const { categoriesCollection } = await import("@/lib/firebase/firestore");
    const snapshot = await categoriesCollection().orderBy("displayOrder", "asc").get();
    const categories = snapshot.docs.map((doc) => doc.data());

    expect(categories.map((c) => c.id)).toEqual(CATEGORY_IDS);
    for (const category of categories) {
      expect(category.isActive).toBe(true);
      expect(category.name.en.length).toBeGreaterThan(0);
      expect(category.name.ar).toBeTruthy();
    }
  });

  it("seeds one active showcase per category, referencing a real category", async () => {
    const { categoryShowcasesCollection } = await import("@/lib/firebase/firestore");
    const snapshot = await categoryShowcasesCollection().where("isActive", "==", true).get();
    const showcases = snapshot.docs.map((doc) => doc.data());

    expect(showcases.length).toBeGreaterThanOrEqual(CATEGORY_IDS.length);
    for (const categoryId of CATEGORY_IDS) {
      expect(showcases.some((s) => s.categoryId === categoryId)).toBe(true);
    }
  });

  it("seeds bilingual products referencing a real category, queryable by categoryId", async () => {
    const { productsCollection } = await import("@/lib/firebase/firestore");
    const snapshot = await productsCollection().where("categoryId", "==", "bracelets").get();
    const products = snapshot.docs.map((doc) => doc.data());

    expect(products.length).toBeGreaterThan(0);
    for (const product of products) {
      expect(product.categoryId).toBe("bracelets");
      expect(product.price).toBeGreaterThan(0);
      expect(product.stock).toBeGreaterThanOrEqual(0);
    }
  });

  it("includes at least one English-only product to exercise the Arabic fallback path", async () => {
    const { productsCollection } = await import("@/lib/firebase/firestore");
    const snapshot = await productsCollection().where("name.en", "==", "Pearl Tennis Bracelet").get();

    expect(snapshot.empty).toBe(false);
    const product = snapshot.docs[0].data();
    expect(product.name.ar).toBeNull();
    expect(product.description.ar).toBeNull();
  });
});
