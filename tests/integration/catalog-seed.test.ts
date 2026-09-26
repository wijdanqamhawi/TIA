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

  // The TIA catalog is fully bilingual: every seeded product carries both
  // English and Arabic copy. (The Arabic→English fallback for a missing
  // translation is covered by `tests/unit/localized-string.test.ts`.)
  it("seeds every product with complete English and Arabic copy", async () => {
    const { productsCollection } = await import("@/lib/firebase/firestore");
    // Only the seeded catalog (its images live under `seed/`): other
    // integration suites share this emulator and insert their own fixtures.
    const products = (await productsCollection().get()).docs
      .map((doc) => doc.data())
      .filter((product) => product.images.some((image) => image.storagePath.startsWith("seed/")));

    expect(products.length).toBe(22);
    for (const product of products) {
      expect(product.name.en.length, `${product.slug} name.en`).toBeGreaterThan(0);
      expect(product.name.ar, `${product.slug} name.ar`).toBeTruthy();
      expect(product.description.en.length, `${product.slug} description.en`).toBeGreaterThan(0);
      expect(product.description.ar, `${product.slug} description.ar`).toBeTruthy();
    }
  });

  it("keeps the renamed Pearl & Turquoise Ring Set on its original slug, in Rings, sold out, with its pinned image", async () => {
    const { productsCollection } = await import("@/lib/firebase/firestore");
    const snapshot = await productsCollection().where("slug", "==", "pearl-tennis-bracelet").get();

    expect(snapshot.size).toBe(1);
    const product = snapshot.docs[0].data();
    expect(product.name.en).toBe("Pearl & Turquoise Ring Set");
    expect(product.name.ar).toBeTruthy();
    expect(product.categoryId).toBe("rings");
    expect(product.stock).toBe(0);
    expect(product.images[0]?.url).toBe("/images/demo/product-02.jpg");
  });
});
