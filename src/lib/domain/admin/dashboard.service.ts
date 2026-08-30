import "server-only";
import { ordersCollection, productsCollection, usersCollection } from "@/lib/firebase/firestore";
import type { Order } from "@/types/order";
import type { Product } from "@/types/product";

export type DashboardStats = {
  totalOrders: number;
  totalSales: number;
  pendingOrders: number;
  totalProducts: number;
  totalCustomers: number;
  soldOutProducts: number;
};

export type BestSellerRow = { productId: string; nameEn: string; quantitySold: number };

const RECENT_ORDERS_SCAN_LIMIT = 500;

/**
 * Pure statistics computation (T169, T174 unit-tests this directly with no
 * Firestore involved). `totalOrders`/`totalSales` deliberately **exclude**
 * `CANCELLED` orders — a cancelled order was never actually fulfilled/paid
 * for, so counting it would overstate real sales performance (this task's
 * explicit requirement).
 */
export function computeDashboardStats(
  orders: Order[],
  products: Product[],
  customerCount: number,
): DashboardStats {
  const activeOrders = orders.filter((order) => order.status !== "CANCELLED");

  return {
    totalOrders: activeOrders.length,
    totalSales: activeOrders.reduce((sum, order) => sum + order.total, 0),
    pendingOrders: orders.filter((order) => order.status === "PENDING").length,
    totalProducts: products.length,
    totalCustomers: customerCount,
    soldOutProducts: products.filter((product) => product.stock === 0).length,
  };
}

/**
 * Best-selling products ranked by quantity sold (T169). Computed directly
 * from non-cancelled orders' line items — rather than trusting the
 * persisted `Product.salesCount` counter — so a cancelled order can never
 * count toward the ranking regardless of counter-maintenance correctness
 * elsewhere (T174's explicit "excludes cancelled orders... from best-seller
 * ranking" requirement).
 */
export function computeBestSellers(orders: Order[], products: Product[], limit = 5): BestSellerRow[] {
  const productNames = new Map(products.map((product) => [product.id, product.name.en]));
  const quantityByProduct = new Map<string, number>();

  for (const order of orders) {
    if (order.status === "CANCELLED") continue;
    for (const item of order.items) {
      quantityByProduct.set(item.productId, (quantityByProduct.get(item.productId) ?? 0) + item.quantity);
    }
  }

  return Array.from(quantityByProduct.entries())
    .map(([productId, quantitySold]) => ({ productId, nameEn: productNames.get(productId) ?? "(deleted product)", quantitySold }))
    .sort((a, b) => b.quantitySold - a.quantitySold)
    .slice(0, limit);
}

/** Reads recent orders/products/customer count from Firestore and computes dashboard stats (T170's `/admin` page). */
export async function getDashboardStats(): Promise<{ stats: DashboardStats; bestSellers: BestSellerRow[] }> {
  const [ordersSnapshot, productsSnapshot, customerCountSnapshot] = await Promise.all([
    ordersCollection().orderBy("createdAt", "desc").limit(RECENT_ORDERS_SCAN_LIMIT).get(),
    productsCollection().get(),
    usersCollection().where("role", "==", "CUSTOMER").count().get(),
  ]);

  const orders = ordersSnapshot.docs.map((doc) => doc.data());
  const products = productsSnapshot.docs.map((doc) => doc.data());

  return {
    stats: computeDashboardStats(orders, products, customerCountSnapshot.data().count),
    bestSellers: computeBestSellers(orders, products),
  };
}

/** The most recent orders (any status) for the dashboard's "Recent Orders" panel. */
export async function getRecentOrders(limit = 10): Promise<Order[]> {
  const snapshot = await ordersCollection().orderBy("createdAt", "desc").limit(limit).get();
  return snapshot.docs.map((doc) => doc.data());
}
