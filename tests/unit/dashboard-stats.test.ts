import { describe, expect, it } from "vitest";
import { computeDashboardStats, computeBestSellers } from "@/lib/domain/admin/dashboard.service";
import type { Order, OrderStatus } from "@/types/order";
import type { Product } from "@/types/product";

/** T174: dashboard statistics exclude cancelled orders from totals and best-seller ranking. */

function makeOrder(id: string, status: OrderStatus, total: number, items: { productId: string; quantity: number }[]): Order {
  return {
    id,
    orderNumber: `ELR-20260827-000${id}`,
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

describe("computeDashboardStats", () => {
  it("excludes CANCELLED orders from totalOrders/totalSales", () => {
    const orders = [
      makeOrder("1", "PENDING", 1000, [{ productId: "p1", quantity: 1 }]),
      makeOrder("2", "DELIVERED", 2000, [{ productId: "p1", quantity: 2 }]),
      makeOrder("3", "CANCELLED", 5000, [{ productId: "p2", quantity: 5 }]),
    ];
    const products = [makeProduct("p1", "Ring", 3), makeProduct("p2", "Bracelet", 0)];

    const stats = computeDashboardStats(orders, products, 10);

    expect(stats.totalOrders).toBe(2);
    expect(stats.totalSales).toBe(3000);
    expect(stats.pendingOrders).toBe(1);
    expect(stats.totalProducts).toBe(2);
    expect(stats.totalCustomers).toBe(10);
    expect(stats.soldOutProducts).toBe(1);
  });

  it("counts every product as sold out only when stock is exactly 0", () => {
    const products = [makeProduct("p1", "Ring", 0), makeProduct("p2", "Bracelet", 1)];
    const stats = computeDashboardStats([], products, 0);
    expect(stats.soldOutProducts).toBe(1);
  });
});

describe("computeBestSellers", () => {
  it("excludes a cancelled order's items from the ranking", () => {
    const orders = [
      makeOrder("1", "DELIVERED", 1000, [{ productId: "p1", quantity: 2 }]),
      makeOrder("2", "CANCELLED", 5000, [{ productId: "p1", quantity: 100 }]),
      makeOrder("3", "PENDING", 1000, [{ productId: "p2", quantity: 1 }]),
    ];
    const products = [makeProduct("p1", "Ring", 3), makeProduct("p2", "Bracelet", 3)];

    const bestSellers = computeBestSellers(orders, products, 5);

    expect(bestSellers).toEqual([
      { productId: "p1", nameEn: "Ring", quantitySold: 2 },
      { productId: "p2", nameEn: "Bracelet", quantitySold: 1 },
    ]);
  });

  it("respects the limit and sorts descending", () => {
    const orders = [
      makeOrder("1", "DELIVERED", 1000, [{ productId: "p1", quantity: 1 }]),
      makeOrder("2", "DELIVERED", 1000, [{ productId: "p2", quantity: 3 }]),
      makeOrder("3", "DELIVERED", 1000, [{ productId: "p3", quantity: 2 }]),
    ];
    const products = [makeProduct("p1", "A", 1), makeProduct("p2", "B", 1), makeProduct("p3", "C", 1)];

    const bestSellers = computeBestSellers(orders, products, 2);

    expect(bestSellers).toHaveLength(2);
    expect(bestSellers[0]).toEqual({ productId: "p2", nameEn: "B", quantitySold: 3 });
    expect(bestSellers[1]).toEqual({ productId: "p3", nameEn: "C", quantitySold: 2 });
  });
});
