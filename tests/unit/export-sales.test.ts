import { describe, expect, it } from "vitest";
import { computeSalesExportRows, computeBestSellerExportRows } from "@/lib/domain/admin/export.service";
import { computeDashboardStats, computeBestSellers } from "@/lib/domain/admin/dashboard.service";
import type { Order, OrderStatus } from "@/types/order";
import type { Product } from "@/types/product";

/** T309: the Sales and Best-Sellers export computations exclude cancelled orders and match the dashboard-stats logic (T169) bit-for-bit. */

function makeOrder(id: string, status: OrderStatus, total: number, items: { productId: string; quantity: number }[]): Order {
  return {
    id,
    orderNumber: `ELR-20260830-000${id}`,
    userId: null,
    customerSnapshot: { fullName: "Test", email: "test@example.com", phone: "+1" },
    deliverySnapshot: {
      regionId: "west-bank",
      regionName: { en: "West Bank", ar: null },
      locationId: "loc",
      locationName: { en: "Ramallah", ar: null },
      fullAddress: "123 Main St",
    },
    items: items.map((item) => ({
      productId: item.productId,
      productName: { en: "Product", ar: null },
      selectedOption: null,
      unitPrice: 1000,
      originalPrice: 1000,
      wasOnSale: false,
      quantity: item.quantity,
    })),
    notes: null,
    paymentMethod: "CASH_ON_DELIVERY",
    status,
    subtotal: total,
    total,
    createdAt: {} as never,
    updatedAt: {} as never,
  };
}

function makeProduct(id: string, nameEn: string, stock: number): Product {
  return {
    id,
    name: { en: nameEn, ar: null },
    slug: nameEn.toLowerCase(),
    description: { en: "", ar: null },
    price: 1000,
    categoryId: "rings",
    images: [],
    material: { en: "Gold", ar: null },
    options: [],
    stock,
    availability: true,
    isNewArrival: false,
    isBestSeller: false,
    salesCount: 0,
    searchTerms: [],
    isOnSale: false,
    salePrice: null,
    saleStartAt: null,
    saleEndAt: null,
    createdAt: {} as never,
    updatedAt: {} as never,
  };
}

describe("computeSalesExportRows", () => {
  it("matches computeDashboardStats' totalOrders/totalSales bit-for-bit, excluding cancelled orders", () => {
    const orders = [
      makeOrder("1", "PENDING", 1000, [{ productId: "p1", quantity: 1 }]),
      makeOrder("2", "DELIVERED", 2000, [{ productId: "p1", quantity: 2 }]),
      makeOrder("3", "CANCELLED", 5000, [{ productId: "p2", quantity: 5 }]),
    ];

    const rows = computeSalesExportRows(orders);
    const stats = computeDashboardStats(orders, [], 0);

    expect(rows).toEqual([
      { metric: "Total Orders", value: String(stats.totalOrders) },
      { metric: "Total Sales", value: (stats.totalSales / 100).toFixed(2) },
      { metric: "Pending Orders", value: String(stats.pendingOrders) },
    ]);
    expect(rows[0].value).toBe("2");
    expect(rows[1].value).toBe("30.00");
  });
});

describe("computeBestSellerExportRows", () => {
  it("matches computeBestSellers' ranking bit-for-bit, excluding cancelled orders", () => {
    const orders = [
      makeOrder("1", "DELIVERED", 1000, [{ productId: "p1", quantity: 2 }]),
      makeOrder("2", "CANCELLED", 5000, [{ productId: "p1", quantity: 100 }]),
      makeOrder("3", "PENDING", 1000, [{ productId: "p2", quantity: 1 }]),
    ];
    const products = [makeProduct("p1", "Ring", 3), makeProduct("p2", "Bracelet", 3)];

    const rows = computeBestSellerExportRows(orders, products);
    const expected = computeBestSellers(orders, products, products.length);

    expect(rows).toEqual(expected);
    expect(rows).toEqual([
      { productId: "p1", nameEn: "Ring", quantitySold: 2 },
      { productId: "p2", nameEn: "Bracelet", quantitySold: 1 },
    ]);
  });
});
