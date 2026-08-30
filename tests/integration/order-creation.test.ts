import { afterEach, describe, expect, it } from "vitest";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { DocumentReference } from "firebase-admin/firestore";

/**
 * Requires the Firebase Local Emulator Suite (Firestore) running — see
 * tests/integration/catalog-seed.test.ts. Exercises the REAL `createOrder`
 * order-creation transaction (T123) end to end against real Firestore:
 * authoritative pricing (including Special Offers, T130's bilingual
 * snapshot requirement), Sold Out/stock/location revalidation, stock
 * decrement, cart clearing, order number generation, and concurrent
 * last-unit protection. Each test creates its own throwaway fixtures
 * (never relying on `scripts/seed.ts` having been run) and cleans them up
 * afterward, mirroring `order-transaction.test.ts`/`cart-merge.test.ts`.
 */
const hasEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

const CHECKOUT_BASE = {
  fullName: "Jane Shopper",
  phone: "+970599123456",
  email: "jane@example.com",
  fullAddress: "123 Main St, Apt 4",
  notes: null as string | null,
  paymentMethod: "CASH_ON_DELIVERY" as const,
};

describe.skipIf(!hasEmulator)("createOrder — full order-creation transaction (Firebase Local Emulator Suite)", () => {
  const createdRefs: DocumentReference[] = [];

  afterEach(async () => {
    await Promise.all(createdRefs.splice(0).map((ref) => ref.delete()));
  });

  async function seedProduct(overrides: Record<string, unknown> = {}) {
    const { productsCollection } = await import("@/lib/firebase/firestore");
    const ref = productsCollection().doc();
    createdRefs.push(ref);
    await ref.set({
      id: ref.id,
      name: { en: "Order Test Product", ar: "منتج اختبار الطلب" },
      slug: `order-test-${ref.id}`,
      description: { en: "test", ar: null },
      price: 10000,
      categoryId: "bracelets",
      images: [],
      material: { en: "test", ar: null },
      options: [],
      stock: 5,
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
      ...overrides,
    });
    return ref.id;
  }

  async function seedDeliveryLocation(isActive = true) {
    const { deliveryRegionsCollection, deliveryLocationsCollection } = await import("@/lib/firebase/firestore");

    const regionRef = deliveryRegionsCollection().doc("west-bank");
    const regionSnapshot = await regionRef.get();
    if (!regionSnapshot.exists) {
      createdRefs.push(regionRef);
      await regionRef.set({
        id: "west-bank",
        regionId: "west-bank",
        name: { en: "West Bank", ar: "الضفة الغربية" },
        displayOrder: 1,
        isActive: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    const locationRef = deliveryLocationsCollection().doc();
    createdRefs.push(locationRef);
    await locationRef.set({
      id: locationRef.id,
      regionId: "west-bank",
      name: { en: "Test City", ar: "مدينة اختبار" },
      slug: `test-city-${locationRef.id}`,
      searchTerms: ["test", "city"],
      displayOrder: 1,
      isActive,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return locationRef.id;
  }

  async function seedCartWithItem(productId: string, quantity: number) {
    const { cartsCollection } = await import("@/lib/firebase/firestore");
    const uid = `order-test-cart-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const ref = cartsCollection().doc(uid);
    createdRefs.push(ref);
    await ref.set({
      id: uid,
      items: [{ productId, selectedOption: null, quantity }],
      expiresAt: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return ref;
  }

  it("creates an order with authoritative pricing, decrements stock, increments salesCount, and clears the cart", async () => {
    const productId = await seedProduct({ price: 10000, stock: 5 });
    const locationId = await seedDeliveryLocation();
    const cartRef = await seedCartWithItem(productId, 2);

    const { createOrder, getOrderByNumber } = await import("@/lib/domain/orders/order.service");
    const { getAdminFirestore, productsCollection, ordersCollection } = await import("@/lib/firebase/firestore");

    const result = await createOrder(getAdminFirestore(), {
      uid: null,
      cartRef,
      checkout: { ...CHECKOUT_BASE, regionId: "west-bank", locationId },
      paymentMethodType: "CASH_ON_DELIVERY",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.orderNumber).toMatch(/^ELR-\d{8}-\d{4}$/);

    const order = await getOrderByNumber(result.orderNumber);
    expect(order).not.toBeNull();
    createdRefs.push(ordersCollection().doc(order!.id));

    expect(order!.subtotal).toBe(20000);
    expect(order!.total).toBe(20000);
    expect(order!.status).toBe("PENDING");
    expect(order!.userId).toBeNull();
    expect(order!.customerSnapshot).toEqual({
      fullName: "Jane Shopper",
      email: "jane@example.com",
      phone: "+970599123456",
    });
    expect(order!.items[0].unitPrice).toBe(10000);
    // T130: bilingual snapshot captured at purchase time, both en and ar.
    expect(order!.items[0].productName).toEqual({ en: "Order Test Product", ar: "منتج اختبار الطلب" });

    const productSnapshot = await productsCollection().doc(productId).get();
    expect(productSnapshot.data()?.stock).toBe(3);
    expect(productSnapshot.data()?.salesCount).toBe(2);

    const cartSnapshot = await cartRef.get();
    expect(cartSnapshot.data()?.items).toEqual([]);
  });

  it("prices at the active Special Offer sale price and records wasOnSale/originalPrice (spec FR-119/FR-121)", async () => {
    const productId = await seedProduct({ price: 10000, isOnSale: true, salePrice: 7500 });
    const locationId = await seedDeliveryLocation();
    const cartRef = await seedCartWithItem(productId, 1);

    const { createOrder, getOrderByNumber } = await import("@/lib/domain/orders/order.service");
    const { getAdminFirestore, ordersCollection } = await import("@/lib/firebase/firestore");

    const result = await createOrder(getAdminFirestore(), {
      uid: null,
      cartRef,
      checkout: { ...CHECKOUT_BASE, regionId: "west-bank", locationId },
      paymentMethodType: "CASH_ON_DELIVERY",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const order = await getOrderByNumber(result.orderNumber);
    createdRefs.push(ordersCollection().doc(order!.id));

    expect(order!.items[0].unitPrice).toBe(7500);
    expect(order!.items[0].originalPrice).toBe(10000);
    expect(order!.items[0].wasOnSale).toBe(true);
    expect(order!.subtotal).toBe(7500);
  });

  it("ignores an expired Special Offer and prices at the regular price (never stale/browser promotional pricing)", async () => {
    const past = Timestamp.fromMillis(Date.now() - 60 * 60 * 1000);
    const productId = await seedProduct({ price: 10000, isOnSale: true, salePrice: 7500, saleEndAt: past });
    const locationId = await seedDeliveryLocation();
    const cartRef = await seedCartWithItem(productId, 1);

    const { createOrder, getOrderByNumber } = await import("@/lib/domain/orders/order.service");
    const { getAdminFirestore, ordersCollection } = await import("@/lib/firebase/firestore");

    const result = await createOrder(getAdminFirestore(), {
      uid: null,
      cartRef,
      checkout: { ...CHECKOUT_BASE, regionId: "west-bank", locationId },
      paymentMethodType: "CASH_ON_DELIVERY",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const order = await getOrderByNumber(result.orderNumber);
    createdRefs.push(ordersCollection().doc(order!.id));

    expect(order!.items[0].unitPrice).toBe(10000);
    expect(order!.items[0].wasOnSale).toBe(false);
  });

  it("rejects a Sold Out product, creates no order, and leaves the cart intact", async () => {
    const productId = await seedProduct({ stock: 0 });
    const locationId = await seedDeliveryLocation();
    const cartRef = await seedCartWithItem(productId, 1);

    const { createOrder } = await import("@/lib/domain/orders/order.service");
    const { getAdminFirestore } = await import("@/lib/firebase/firestore");

    const result = await createOrder(getAdminFirestore(), {
      uid: null,
      cartRef,
      checkout: { ...CHECKOUT_BASE, regionId: "west-bank", locationId },
      paymentMethodType: "CASH_ON_DELIVERY",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("SOLD_OUT");

    const cartSnapshot = await cartRef.get();
    expect(cartSnapshot.data()?.items).toHaveLength(1);
  });

  it("rejects a quantity exceeding current stock", async () => {
    const productId = await seedProduct({ stock: 2 });
    const locationId = await seedDeliveryLocation();
    const cartRef = await seedCartWithItem(productId, 5);

    const { createOrder } = await import("@/lib/domain/orders/order.service");
    const { getAdminFirestore, productsCollection } = await import("@/lib/firebase/firestore");

    const result = await createOrder(getAdminFirestore(), {
      uid: null,
      cartRef,
      checkout: { ...CHECKOUT_BASE, regionId: "west-bank", locationId },
      paymentMethodType: "CASH_ON_DELIVERY",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INSUFFICIENT_STOCK");

    const snapshot = await productsCollection().doc(productId).get();
    expect(snapshot.data()?.stock).toBe(2); // untouched
  });

  it("rejects an inactive delivery location", async () => {
    const productId = await seedProduct();
    const locationId = await seedDeliveryLocation(false);
    const cartRef = await seedCartWithItem(productId, 1);

    const { createOrder } = await import("@/lib/domain/orders/order.service");
    const { getAdminFirestore } = await import("@/lib/firebase/firestore");

    const result = await createOrder(getAdminFirestore(), {
      uid: null,
      cartRef,
      checkout: { ...CHECKOUT_BASE, regionId: "west-bank", locationId },
      paymentMethodType: "CASH_ON_DELIVERY",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("LOCATION_NOT_SUPPORTED");
  });

  it("rejects a locationId that does not exist", async () => {
    const productId = await seedProduct();
    const cartRef = await seedCartWithItem(productId, 1);

    const { createOrder } = await import("@/lib/domain/orders/order.service");
    const { getAdminFirestore } = await import("@/lib/firebase/firestore");

    const result = await createOrder(getAdminFirestore(), {
      uid: null,
      cartRef,
      checkout: { ...CHECKOUT_BASE, regionId: "west-bank", locationId: "does-not-exist" },
      paymentMethodType: "CASH_ON_DELIVERY",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("LOCATION_NOT_SUPPORTED");
  });

  it("rejects an empty cart", async () => {
    const { cartsCollection } = await import("@/lib/firebase/firestore");
    const uid = `order-test-empty-cart-${Date.now()}`;
    const cartRef = cartsCollection().doc(uid);
    createdRefs.push(cartRef);
    await cartRef.set({
      id: uid,
      items: [],
      expiresAt: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const locationId = await seedDeliveryLocation();
    const { createOrder } = await import("@/lib/domain/orders/order.service");
    const { getAdminFirestore } = await import("@/lib/firebase/firestore");

    const result = await createOrder(getAdminFirestore(), {
      uid: null,
      cartRef,
      checkout: { ...CHECKOUT_BASE, regionId: "west-bank", locationId },
      paymentMethodType: "CASH_ON_DELIVERY",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("EMPTY_CART");
  });

  it("exactly one of two concurrent last-unit checkouts succeeds; stock never goes negative", async () => {
    const productId = await seedProduct({ stock: 1 });
    const locationId = await seedDeliveryLocation();
    const cartRefA = await seedCartWithItem(productId, 1);
    const cartRefB = await seedCartWithItem(productId, 1);

    const { createOrder, getOrderByNumber } = await import("@/lib/domain/orders/order.service");
    const { getAdminFirestore, productsCollection, ordersCollection } = await import("@/lib/firebase/firestore");
    const db = getAdminFirestore();

    const attempt = (cartRef: typeof cartRefA) =>
      createOrder(db, {
        uid: null,
        cartRef,
        checkout: { ...CHECKOUT_BASE, regionId: "west-bank", locationId },
        paymentMethodType: "CASH_ON_DELIVERY",
      });

    const [resultA, resultB] = await Promise.all([attempt(cartRefA), attempt(cartRefB)]);
    const results = [resultA, resultB];
    const succeeded = results.filter((r) => r.ok);
    const failed = results.filter((r) => !r.ok);

    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);

    const succeededOrder = succeeded[0];
    if (succeededOrder.ok) {
      const order = await getOrderByNumber(succeededOrder.orderNumber);
      if (order) createdRefs.push(ordersCollection().doc(order.id));
    }

    const snapshot = await productsCollection().doc(productId).get();
    expect(snapshot.data()?.stock).toBe(0);
    expect(snapshot.data()?.stock).toBeGreaterThanOrEqual(0);
  });
});
