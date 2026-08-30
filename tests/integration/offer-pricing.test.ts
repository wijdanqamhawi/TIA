import { afterEach, describe, expect, it } from "vitest";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { DocumentReference } from "firebase-admin/firestore";

/**
 * Requires the Firebase Local Emulator Suite (Firestore) running, with
 * FIRESTORE_EMULATOR_HOST set — see tests/integration/catalog-seed.test.ts.
 * Proves Special Offers pricing (T325/T326) is correct against a real
 * Firestore read, not just a mocked product in a unit test: a scheduled
 * offer (future `saleStartAt`) and an expired offer (past `saleEndAt`)
 * must both price at the regular price when read through
 * `buildCartSummary` (Phase 6 cart) and `resolveOrderLinePrices` (Phase 8
 * order-creation prep primitive), not the sale price (spec FR-119/FR-121).
 */
const hasEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

describe.skipIf(!hasEmulator)("Special Offers pricing (Firebase Local Emulator Suite)", () => {
  const createdRefs: DocumentReference[] = [];

  afterEach(async () => {
    await Promise.all(createdRefs.splice(0).map((ref) => ref.delete()));
  });

  async function seedProduct(overrides: Record<string, unknown>) {
    const { productsCollection } = await import("@/lib/firebase/firestore");
    const ref = productsCollection().doc();
    createdRefs.push(ref);
    await ref.set({
      id: ref.id,
      name: { en: "Offer Pricing Test Product", ar: null },
      slug: `offer-pricing-test-${ref.id}`,
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

  it("prices a cart line at the active sale price via buildCartSummary", async () => {
    const productId = await seedProduct({ isOnSale: true, salePrice: 7500 });
    const { buildCartSummary } = await import("@/lib/domain/cart/cart.service");

    const summary = await buildCartSummary({
      id: "test-cart",
      items: [{ productId, selectedOption: null, quantity: 1 }],
      expiresAt: null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    expect(summary.lines[0].product?.price).toBe(7500);
    expect(summary.lines[0].product?.offerStatus).toBe("ACTIVE");
    expect(summary.subtotal).toBe(7500);
  });

  it("prices a scheduled offer (future saleStartAt) at the regular price via buildCartSummary", async () => {
    const future = Timestamp.fromMillis(Date.now() + 60 * 60 * 1000);
    const productId = await seedProduct({ isOnSale: true, salePrice: 7500, saleStartAt: future });
    const { buildCartSummary } = await import("@/lib/domain/cart/cart.service");

    const summary = await buildCartSummary({
      id: "test-cart",
      items: [{ productId, selectedOption: null, quantity: 1 }],
      expiresAt: null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    expect(summary.lines[0].product?.price).toBe(10000);
    expect(summary.lines[0].product?.offerStatus).toBe("SCHEDULED");
  });

  it("prices an expired offer (past saleEndAt) at the regular price via buildCartSummary", async () => {
    const past = Timestamp.fromMillis(Date.now() - 60 * 60 * 1000);
    const productId = await seedProduct({ isOnSale: true, salePrice: 7500, saleEndAt: past });
    const { buildCartSummary } = await import("@/lib/domain/cart/cart.service");

    const summary = await buildCartSummary({
      id: "test-cart",
      items: [{ productId, selectedOption: null, quantity: 1 }],
      expiresAt: null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    expect(summary.lines[0].product?.price).toBe(10000);
    expect(summary.lines[0].product?.offerStatus).toBe("EXPIRED");
  });

  it("resolveOrderLinePrices (Phase 8 prep) matches buildCartSummary's active-offer price", async () => {
    const productId = await seedProduct({ isOnSale: true, salePrice: 6600 });
    const { resolveOrderLinePrices } = await import("@/lib/domain/checkout/checkout.service");

    const result = await resolveOrderLinePrices([{ productId, quantity: 2 }]);

    expect(result).toEqual([{ productId, quantity: 2, unitPrice: 6600 }]);
  });

  it("resolveOrderLinePrices prices a scheduled/expired offer at the regular price", async () => {
    const future = Timestamp.fromMillis(Date.now() + 60 * 60 * 1000);
    const productId = await seedProduct({ isOnSale: true, salePrice: 6600, saleStartAt: future });
    const { resolveOrderLinePrices } = await import("@/lib/domain/checkout/checkout.service");

    const result = await resolveOrderLinePrices([{ productId, quantity: 1 }]);

    expect(result).toEqual([{ productId, quantity: 1, unitPrice: 10000 }]);
  });

  it("a Sold Out product with an active offer is excluded from buildCartSummary's total (spec FR-122)", async () => {
    const productId = await seedProduct({ stock: 0, isOnSale: true, salePrice: 5000 });
    const { buildCartSummary } = await import("@/lib/domain/cart/cart.service");

    const summary = await buildCartSummary({
      id: "test-cart",
      items: [{ productId, selectedOption: null, quantity: 1 }],
      expiresAt: null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    expect(summary.lines[0].issue).toBe("SOLD_OUT");
    expect(summary.subtotal).toBe(0);
  });
});
