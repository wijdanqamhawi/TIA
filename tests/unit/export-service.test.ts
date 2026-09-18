import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { mapProductRow, mapOrderRow } from "@/lib/domain/admin/export.service";
import type { Order } from "@/types/order";
import type { Product } from "@/types/product";

/** T308: export.service.ts's Orders and Products row-mapping functions produce exactly the documented columns, including a blank Arabic-name cell when unset. */

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    name: { en: "Golden Bangle Bracelet", ar: null },
    slug: "golden-bangle-bracelet",
    description: { en: "", ar: null },
    price: 12000,
    categoryId: "bracelets",
    images: [],
    material: { en: "Gold", ar: null },
    options: [],
    stock: 5,
    availability: true,
    isNewArrival: true,
    isBestSeller: false,
    salesCount: 0,
    searchTerms: [],
    isOnSale: false,
    salePrice: null,
    saleStartAt: null,
    saleEndAt: null,
    createdAt: {} as never,
    updatedAt: {} as never,
    ...overrides,
  };
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "o1",
    orderNumber: "ELR-20260830-0001",
    userId: "uid-1",
    customerSnapshot: { fullName: "Jane Doe", email: "jane@example.com", phone: "+970-000" },
    deliverySnapshot: {
      regionId: "west-bank",
      regionName: { en: "West Bank", ar: "الضفة الغربية" },
      locationId: "loc-1",
      locationName: { en: "Ramallah", ar: "رام الله" },
      fullAddress: "123 Main St",
    },
    items: [
      {
        productId: "p1",
        productName: { en: "Golden Bangle Bracelet", ar: null },
        selectedOption: null,
        unitPrice: 12000,
        originalPrice: 12000,
        wasOnSale: false,
        quantity: 2,
      },
    ],
    notes: null,
    paymentMethod: "CASH_ON_DELIVERY",
    status: "PENDING",
    subtotal: 24000,
    total: 24000,
    createdAt: Timestamp.fromMillis(1_700_000_000_000),
    updatedAt: Timestamp.fromMillis(1_700_000_000_000),
    ...overrides,
  };
}

describe("mapProductRow", () => {
  it("produces exactly the documented columns", () => {
    const categoryNameById = new Map([["bracelets", "Bracelets"]]);
    const row = mapProductRow(makeProduct(), categoryNameById);

    expect(row).toEqual({
      id: "p1",
      nameEn: "Golden Bangle Bracelet",
      nameAr: "",
      category: "Bracelets",
      price: 120,
      stock: 5,
      soldOut: "No",
      availability: "Yes",
      newArrival: "Yes",
      bestSeller: "No",
      offerStatus: "No Offer",
      isOnSale: "No",
      salePrice: "",
      saleStartAt: "",
      saleEndAt: "",
    });
  });

  it("T331: includes the derived offer status and sale price/dates for an active offer", () => {
    const now = Timestamp.fromMillis(1_700_000_000_000);
    const row = mapProductRow(
      makeProduct({ isOnSale: true, salePrice: 9999, saleStartAt: null, saleEndAt: null }),
      new Map(),
      now,
    );

    expect(row.offerStatus).toBe("On Sale");
    expect(row.isOnSale).toBe("Yes");
    expect(row.salePrice).toBe(99.99);
  });

  it("T331: reports Scheduled/Expired/No Offer correctly, and leaves salePrice/dates blank when unset — never null/undefined", () => {
    const now = Timestamp.fromMillis(1_700_000_000_000);
    const future = Timestamp.fromMillis(now.toMillis() + 1000);
    const past = Timestamp.fromMillis(now.toMillis() - 1000);

    const scheduled = mapProductRow(
      makeProduct({ isOnSale: true, salePrice: 9999, saleStartAt: future, saleEndAt: null }),
      new Map(),
      now,
    );
    expect(scheduled.offerStatus).toBe("Scheduled");
    expect(scheduled.saleStartAt).toBe(future.toDate().toISOString());

    const expired = mapProductRow(
      makeProduct({ isOnSale: true, salePrice: 9999, saleStartAt: null, saleEndAt: past }),
      new Map(),
      now,
    );
    expect(expired.offerStatus).toBe("Expired");
    expect(expired.saleEndAt).toBe(past.toDate().toISOString());

    const noOffer = mapProductRow(makeProduct(), new Map(), now);
    expect(noOffer.offerStatus).toBe("No Offer");
    expect(noOffer.isOnSale).toBe("No");
    expect(noOffer.salePrice).toBe("");
    expect(noOffer.saleStartAt).toBe("");
    expect(noOffer.saleEndAt).toBe("");
  });

  it("leaves the Arabic-name cell blank when unset, never null/undefined", () => {
    const row = mapProductRow(makeProduct({ name: { en: "Ring", ar: null } }), new Map());
    expect(row.nameAr).toBe("");
  });

  it("populates the Arabic-name cell when set", () => {
    const row = mapProductRow(makeProduct({ name: { en: "Ring", ar: "خاتم" } }), new Map());
    expect(row.nameAr).toBe("خاتم");
  });

  it("derives Sold Out from stock === 0, never a separately-set field", () => {
    expect(mapProductRow(makeProduct({ stock: 0 }), new Map()).soldOut).toBe("Yes");
    expect(mapProductRow(makeProduct({ stock: 1 }), new Map()).soldOut).toBe("No");
  });

  it("falls back to the raw categoryId for an unknown/deleted category", () => {
    const row = mapProductRow(makeProduct({ categoryId: "deleted-category" }), new Map());
    expect(row.category).toBe("deleted-category");
  });
});

describe("mapOrderRow", () => {
  it("produces exactly the documented columns", () => {
    const row = mapOrderRow(makeOrder());

    expect(row).toEqual({
      orderNumber: "ELR-20260830-0001",
      date: new Date(1_700_000_000_000).toISOString(),
      customerName: "Jane Doe",
      phone: "+970-000",
      email: "jane@example.com",
      region: "West Bank",
      city: "Ramallah",
      address: "123 Main St",
      products: "Golden Bangle Bracelet x2 @ 120.00",
      total: 240,
      paymentMethod: "CASH_ON_DELIVERY",
      status: "PENDING",
      customerType: "Registered",
    });
  });

  it("marks a guest order (no userId) as Guest, not Registered", () => {
    const row = mapOrderRow(makeOrder({ userId: null }));
    expect(row.customerType).toBe("Guest");
  });

  it("resolves bilingual delivery/product names in the requested locale, falling back to English", () => {
    const row = mapOrderRow(makeOrder(), "ar");
    expect(row.region).toBe("الضفة الغربية");
    expect(row.city).toBe("رام الله");
    // product name has no Arabic set, so the products string still falls back to English
    expect(row.products).toContain("Golden Bangle Bracelet");
  });
});
