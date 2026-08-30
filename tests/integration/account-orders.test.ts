import { afterEach, describe, expect, it } from "vitest";
import { FieldValue } from "firebase-admin/firestore";
import type { DocumentReference } from "firebase-admin/firestore";

/**
 * Requires the Firebase Local Emulator Suite (Firestore) running — see
 * tests/integration/catalog-seed.test.ts. Exercises `getOrdersForCustomer`
 * and `getOrderForCustomer` (T136/T138) against real Firestore, proving
 * the customer-isolation guarantee this task explicitly requires: one
 * customer's order history/detail query can never surface another
 * customer's order.
 */
const hasEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

describe.skipIf(!hasEmulator)("account order history/detail — customer isolation (Firebase Local Emulator Suite)", () => {
  const createdRefs: DocumentReference[] = [];

  afterEach(async () => {
    await Promise.all(createdRefs.splice(0).map((ref) => ref.delete()));
  });

  async function seedOrder(userId: string | null, overrides: Record<string, unknown> = {}) {
    const { ordersCollection } = await import("@/lib/firebase/firestore");
    const ref = ordersCollection().doc();
    createdRefs.push(ref);
    await ref.set({
      id: ref.id,
      orderNumber: `ELR-TEST-${ref.id}`,
      userId,
      customerSnapshot: { fullName: "Test Customer", email: "test@example.com", phone: "+970599123456" },
      deliverySnapshot: {
        regionId: "west-bank",
        regionName: { en: "West Bank", ar: null },
        locationId: "test-location",
        locationName: { en: "Test City", ar: null },
        fullAddress: "123 Main St",
      },
      items: [],
      notes: null,
      paymentMethod: "CASH_ON_DELIVERY",
      status: "PENDING",
      subtotal: 10000,
      total: 10000,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      ...overrides,
    });
    return ref.id;
  }

  it("getOrdersForCustomer returns only the requesting customer's own orders", async () => {
    const uidA = `customer-a-${Date.now()}`;
    const uidB = `customer-b-${Date.now()}`;
    await seedOrder(uidA);
    await seedOrder(uidA);
    await seedOrder(uidB);

    const { getOrdersForCustomer } = await import("@/lib/domain/orders/order.service");
    const resultA = await getOrdersForCustomer(uidA);

    expect(resultA.orders).toHaveLength(2);
    expect(resultA.orders.every((o) => o.userId === uidA)).toBe(true);
  });

  it("getOrderForCustomer returns null for another customer's order (never leaks existence)", async () => {
    const uidA = `customer-a-${Date.now()}`;
    const uidB = `customer-b-${Date.now()}`;
    const orderIdB = await seedOrder(uidB);

    const { getOrderForCustomer, getOrderByNumber } = await import("@/lib/domain/orders/order.service");
    const orderB = await getOrderByNumber(`ELR-TEST-${orderIdB}`);
    expect(orderB).not.toBeNull();

    const resultFromA = await getOrderForCustomer(orderB!.orderNumber, uidA);
    expect(resultFromA).toBeNull();

    const resultFromB = await getOrderForCustomer(orderB!.orderNumber, uidB);
    expect(resultFromB).not.toBeNull();
    expect(resultFromB!.userId).toBe(uidB);
  });

  it("getOrderForCustomer returns null for a guest order (userId: null) even for a signed-in customer", async () => {
    const uidA = `customer-a-${Date.now()}`;
    const guestOrderId = await seedOrder(null);

    const { getOrderForCustomer, getOrderByNumber } = await import("@/lib/domain/orders/order.service");
    const guestOrder = await getOrderByNumber(`ELR-TEST-${guestOrderId}`);

    const result = await getOrderForCustomer(guestOrder!.orderNumber, uidA);
    expect(result).toBeNull();
  });

  it("getOrderForCustomer returns null for a nonexistent order number", async () => {
    const { getOrderForCustomer } = await import("@/lib/domain/orders/order.service");
    const result = await getOrderForCustomer("ELR-DOES-NOT-EXIST", "some-uid");
    expect(result).toBeNull();
  });
});
