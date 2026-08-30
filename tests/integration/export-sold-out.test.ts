import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * T310: the SOLD OUT export lists exactly the products with `stock === 0`
 * — no more, no fewer. Requires the Firebase Local Emulator Suite running
 * (see `catalog-seed.test.ts` for the exact setup) — skipped automatically
 * otherwise, so `npm run test:unit` never needs it.
 */
const hasEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

describe.skipIf(!hasEmulator)("SOLD OUT export (Firebase Local Emulator Suite)", () => {
  const IN_STOCK_ID = "export-test-in-stock";
  const SOLD_OUT_ID = "export-test-sold-out";

  beforeAll(async () => {
    const { productsCollection } = await import("@/lib/firebase/firestore");
    const { Timestamp } = await import("firebase-admin/firestore");
    const now = Timestamp.now();
    const base = {
      description: { en: "", ar: null },
      price: 1000,
      categoryId: "rings",
      images: [],
      material: { en: "Gold", ar: null },
      options: [],
      availability: true,
      isNewArrival: false,
      isBestSeller: false,
      salesCount: 0,
      searchTerms: [],
      isOnSale: false,
      salePrice: null,
      saleStartAt: null,
      saleEndAt: null,
      createdAt: now,
      updatedAt: now,
    };

    await Promise.all([
      productsCollection()
        .doc(IN_STOCK_ID)
        .set({ id: IN_STOCK_ID, name: { en: "Export Test In Stock", ar: null }, slug: IN_STOCK_ID, stock: 3, ...base }),
      productsCollection()
        .doc(SOLD_OUT_ID)
        .set({ id: SOLD_OUT_ID, name: { en: "Export Test Sold Out", ar: null }, slug: SOLD_OUT_ID, stock: 0, ...base }),
    ]);
  }, 15000);

  afterAll(async () => {
    const { productsCollection } = await import("@/lib/firebase/firestore");
    await Promise.all([productsCollection().doc(IN_STOCK_ID).delete(), productsCollection().doc(SOLD_OUT_ID).delete()]);
  });

  it("includes the zero-stock product and excludes the in-stock one", async () => {
    const { getSoldOutExportRows } = await import("@/lib/domain/admin/export.service");
    const rows = await getSoldOutExportRows();

    expect(rows.some((row) => row.id === SOLD_OUT_ID)).toBe(true);
    expect(rows.some((row) => row.id === IN_STOCK_ID)).toBe(false);
  });

  it("never includes a product with stock > 0 — no more, no fewer than the true Sold Out set", async () => {
    const { getSoldOutExportRows } = await import("@/lib/domain/admin/export.service");
    const { productsCollection } = await import("@/lib/firebase/firestore");

    const rows = await getSoldOutExportRows();
    const allProducts = (await productsCollection().get()).docs.map((doc) => doc.data());
    const trueSoldOutIds = new Set(allProducts.filter((p) => p.stock === 0).map((p) => p.id));

    expect(rows.every((row) => trueSoldOutIds.has(row.id))).toBe(true);
    expect(rows.length).toBe(trueSoldOutIds.size);
  });
});
