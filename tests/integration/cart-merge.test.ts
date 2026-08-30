import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Requires the Firebase Local Emulator Suite (Firestore) running — see
 * tests/integration/catalog-seed.test.ts. Exercises the REAL
 * `mergeGuestCartIntoUserCart` transaction end-to-end (real Firestore
 * reads/writes, not a mocked product.service), since the pure clamping
 * logic is already covered in isolation by tests/unit/cart-service.test.ts
 * (T107) — this proves the surrounding transaction (reads, stock lookup,
 * write, guest-cart deletion) is wired correctly against real Firestore.
 */
const hasEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

describe.skipIf(!hasEmulator)("mergeGuestCartIntoUserCart (Firebase Local Emulator Suite)", () => {
  let productId: string;

  beforeAll(async () => {
    const { productsCollection } = await import("@/lib/firebase/firestore");
    const ref = productsCollection().doc();
    await ref.set({
      id: ref.id,
      name: { en: "Cart Merge Test Product", ar: null },
      slug: `cart-merge-test-${ref.id}`,
      description: { en: "test", ar: null },
      price: 5000,
      categoryId: "bracelets",
      images: [],
      material: { en: "test", ar: null },
      options: [],
      stock: 3,
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
    productId = ref.id;
  });

  // Deletes the test product afterward so it never leaks into a real
  // category listing (e.g. Shop/category pages, or a Playwright run
  // sharing this same emulator instance). Test-created carts use
  // synthetic uids that never collide with a real seeded/registered user.
  afterAll(async () => {
    const { productsCollection } = await import("@/lib/firebase/firestore");
    await productsCollection().doc(productId).delete();
  });

  it("merges a guest cart into a fresh user cart, clamped to live stock, and deletes the guest cart", async () => {
    const { guestCartsCollection, cartsCollection } = await import("@/lib/firebase/firestore");
    const { mergeGuestCartIntoUserCart } = await import("@/lib/domain/cart/cart-merge.service");

    const guestCartId = `guest-${Date.now()}`;
    const uid = `user-${Date.now()}`;

    await guestCartsCollection()
      .doc(guestCartId)
      .set({
        id: guestCartId,
        items: [{ productId, selectedOption: null, quantity: 10 }], // exceeds stock (3)
        expiresAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

    await mergeGuestCartIntoUserCart(uid, guestCartId);

    const userCart = await cartsCollection().doc(uid).get();
    expect(userCart.exists).toBe(true);
    expect(userCart.data()!.items).toEqual([{ productId, selectedOption: null, quantity: 3 }]);

    const guestCart = await guestCartsCollection().doc(guestCartId).get();
    expect(guestCart.exists).toBe(false);
  });

  it("sums a guest line into an existing user line for the same product + option", async () => {
    const { guestCartsCollection, cartsCollection } = await import("@/lib/firebase/firestore");
    const { mergeGuestCartIntoUserCart } = await import("@/lib/domain/cart/cart-merge.service");

    const guestCartId = `guest-${Date.now()}-2`;
    const uid = `user-${Date.now()}-2`;

    await cartsCollection()
      .doc(uid)
      .set({
        id: uid,
        items: [{ productId, selectedOption: null, quantity: 1 }],
        expiresAt: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

    await guestCartsCollection()
      .doc(guestCartId)
      .set({
        id: guestCartId,
        items: [{ productId, selectedOption: null, quantity: 1 }],
        expiresAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

    await mergeGuestCartIntoUserCart(uid, guestCartId);

    const userCart = await cartsCollection().doc(uid).get();
    // 1 (existing) + 1 (guest) = 2, well under stock (3)
    expect(userCart.data()!.items).toEqual([{ productId, selectedOption: null, quantity: 2 }]);
  });

  it("is a no-op when there is no guest cart to merge", async () => {
    const { cartsCollection } = await import("@/lib/firebase/firestore");
    const { mergeGuestCartIntoUserCart } = await import("@/lib/domain/cart/cart-merge.service");

    const uid = `user-${Date.now()}-3`;
    await mergeGuestCartIntoUserCart(uid, `nonexistent-guest-cart-${Date.now()}`);

    const userCart = await cartsCollection().doc(uid).get();
    expect(userCart.exists).toBe(false);
  });
});
