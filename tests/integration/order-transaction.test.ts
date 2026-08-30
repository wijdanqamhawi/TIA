import { afterEach, describe, expect, it } from "vitest";
import { FieldValue } from "firebase-admin/firestore";
import type { DocumentReference } from "firebase-admin/firestore";

/**
 * Requires the Firebase Local Emulator Suite (Firestore) running, with
 * FIRESTORE_EMULATOR_HOST set — see tests/integration/catalog-seed.test.ts.
 * Proves the order-creation stock-decrement transaction (T089) is
 * race-free under real concurrent Firestore transactions, not just in a
 * single-process unit test with a fake transaction object.
 */
const hasEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

describe.skipIf(!hasEmulator)("decrementStockForOrder — concurrency (Firebase Local Emulator Suite)", () => {
  // Test-created products are deleted afterward so they never leak into a
  // real category listing (e.g. the Shop/category pages, or a Playwright
  // run sharing this same emulator instance).
  const createdRefs: DocumentReference[] = [];

  afterEach(async () => {
    await Promise.all(createdRefs.splice(0).map((ref) => ref.delete()));
  });

  it("T090/T091/T095: exactly one of two concurrent last-unit purchases succeeds; stock never goes negative", async () => {
    const { getAdminFirestore, productsCollection } = await import("@/lib/firebase/firestore");
    const { decrementStockForOrder, InsufficientStockError } = await import(
      "@/lib/domain/orders/order.service"
    );

    const ref = productsCollection().doc();
    createdRefs.push(ref);
    await ref.set({
      id: ref.id,
      name: { en: "Last Unit Test Product", ar: null },
      slug: `last-unit-test-${ref.id}`,
      description: { en: "test", ar: null },
      price: 1000,
      categoryId: "bracelets",
      images: [],
      material: { en: "test", ar: null },
      options: [],
      stock: 1,
      availability: true,
      isNewArrival: false,
      isBestSeller: false,
      salesCount: 0,
      searchTerms: [],
      isOnSale: false,
      salePrice: null,
      saleStartAt: null,
      saleEndAt: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const attempt = () =>
      getAdminFirestore().runTransaction((transaction) =>
        decrementStockForOrder(transaction, [{ productId: ref.id, quantity: 1 }]),
      );

    const results = await Promise.allSettled([attempt(), attempt()]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(InsufficientStockError);

    const finalSnapshot = await ref.get();
    const finalStock = finalSnapshot.data()?.stock;
    expect(finalStock).toBe(0);
    expect(finalStock).toBeGreaterThanOrEqual(0);
  });

  it("T091: a single request for more than available stock is rejected, not partially applied", async () => {
    const { getAdminFirestore, productsCollection } = await import("@/lib/firebase/firestore");
    const { decrementStockForOrder, InsufficientStockError } = await import(
      "@/lib/domain/orders/order.service"
    );

    const ref = productsCollection().doc();
    createdRefs.push(ref);
    await ref.set({
      id: ref.id,
      name: { en: "Overorder Test Product", ar: null },
      slug: `overorder-test-${ref.id}`,
      description: { en: "test", ar: null },
      price: 1000,
      categoryId: "bracelets",
      images: [],
      material: { en: "test", ar: null },
      options: [],
      stock: 2,
      availability: true,
      isNewArrival: false,
      isBestSeller: false,
      salesCount: 0,
      searchTerms: [],
      isOnSale: false,
      salePrice: null,
      saleStartAt: null,
      saleEndAt: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await expect(
      getAdminFirestore().runTransaction((transaction) =>
        decrementStockForOrder(transaction, [{ productId: ref.id, quantity: 5 }]),
      ),
    ).rejects.toBeInstanceOf(InsufficientStockError);

    const snapshot = await ref.get();
    expect(snapshot.data()?.stock).toBe(2); // untouched — rejected before any write
  });
});
