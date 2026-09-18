import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import {
  productsCollection,
  ordersCollection,
  usersCollection,
  categoriesCollection,
} from "@/lib/firebase/firestore";
import {
  getAllDeliveryRegions,
  getAllDeliveryLocationsByRegion,
} from "@/lib/domain/delivery/deliveryLocation.service";
import { isSoldOut } from "@/lib/domain/catalog/soldOut";
import { getOfferStatus, type OfferStatus } from "@/lib/domain/catalog/offer";
import { computeDashboardStats, computeBestSellers } from "@/lib/domain/admin/dashboard.service";
import { fromMinorUnits } from "@/lib/utils/currency";
import { resolveLocalizedString } from "@/types/localizedString";
import type { Product } from "@/types/product";
import type { Order, OrderStatus } from "@/types/order";
import type { User } from "@/types/user";

/**
 * Admin export domain service (T294, spec FR-099–FR-112). Every function
 * here reads live Firestore data via the Admin SDK at call time — nothing
 * is cached or pre-generated (Constitution Principle 7) — and every
 * row-mapping function is a **pure** function of already-fetched domain
 * objects, so it can be unit-tested with no Firestore/emulator involved
 * (T308, T309). Sales/Best-Sellers reuse `computeDashboardStats`/
 * `computeBestSellers` (T169) verbatim rather than recomputing the
 * cancelled-order-exclusion logic a second way; SOLD OUT reuses `isSoldOut`
 * (T083) verbatim — neither figure can ever drift from its dashboard/
 * storefront counterpart.
 */

// --- Products / Inventory / SOLD OUT ---

const OFFER_STATUS_LABEL: Record<OfferStatus, string> = {
  DISABLED: "No Offer",
  SCHEDULED: "Scheduled",
  ACTIVE: "On Sale",
  EXPIRED: "Expired",
};

export type ProductExportRow = {
  id: string;
  nameEn: string;
  nameAr: string;
  category: string;
  price: number;
  stock: number;
  soldOut: "Yes" | "No";
  availability: "Yes" | "No";
  newArrival: "Yes" | "No";
  bestSeller: "Yes" | "No";
  /** Derived via `getOfferStatus` (T316) — never a stored field, so this can never drift from the admin badge (T330) or storefront pricing (spec FR-124). */
  offerStatus: string;
  isOnSale: "Yes" | "No";
  /** Blank (never `0`/`null`) when no sale price is set — matches the blank-Arabic-name convention already used for `nameAr`. */
  salePrice: number | "";
  saleStartAt: string;
  saleEndAt: string;
};

/** Pure row mapping (T308) — `categoryNameById` falls back to the raw `categoryId` for a deleted/unknown category, never throwing. `now` defaults to the current instant; a fixed value is unit-test-only (mirrors `resolveOfferPricing`'s own `now` parameter pattern). */
export function mapProductRow(
  product: Product,
  categoryNameById: Map<string, string>,
  now: Timestamp = Timestamp.now(),
): ProductExportRow {
  return {
    id: product.id,
    nameEn: product.name.en,
    nameAr: product.name.ar ?? "",
    category: categoryNameById.get(product.categoryId) ?? product.categoryId,
    price: fromMinorUnits(product.price),
    stock: product.stock,
    soldOut: isSoldOut(product) ? "Yes" : "No",
    availability: product.availability ? "Yes" : "No",
    newArrival: product.isNewArrival ? "Yes" : "No",
    bestSeller: product.isBestSeller ? "Yes" : "No",
    offerStatus: OFFER_STATUS_LABEL[getOfferStatus(product, now)],
    isOnSale: product.isOnSale ? "Yes" : "No",
    salePrice: product.salePrice != null ? fromMinorUnits(product.salePrice) : "",
    saleStartAt: product.saleStartAt ? product.saleStartAt.toDate().toISOString() : "",
    saleEndAt: product.saleEndAt ? product.saleEndAt.toDate().toISOString() : "",
  };
}

async function getCategoryNameById(): Promise<Map<string, string>> {
  const snapshot = await categoriesCollection().get();
  return new Map(snapshot.docs.map((doc) => [doc.id, doc.data().name.en]));
}

/** Products report (T296, spec FR-103), optionally filtered to one category. */
export async function getProductExportRows(categoryId?: string): Promise<ProductExportRow[]> {
  const [productsSnapshot, categoryNameById] = await Promise.all([
    categoryId ? productsCollection().where("categoryId", "==", categoryId).get() : productsCollection().get(),
    getCategoryNameById(),
  ]);
  return productsSnapshot.docs.map((doc) => mapProductRow(doc.data(), categoryNameById));
}

/** Inventory report (T297, spec FR-108): same shape as Products, optionally filtered to `stock <= lowStockThreshold`. Applied in application code — Firestore has no server-side "product stock vs. arbitrary request-supplied threshold" index to filter on. */
export async function getInventoryExportRows(lowStockThreshold?: number): Promise<ProductExportRow[]> {
  const rows = await getProductExportRows();
  if (lowStockThreshold === undefined) return rows;
  return rows.filter((row) => row.stock <= lowStockThreshold);
}

/** SOLD OUT report (T298, spec FR-106): exactly the products where `isSoldOut` is true — no more, no fewer. */
export async function getSoldOutExportRows(): Promise<ProductExportRow[]> {
  const rows = await getProductExportRows();
  return rows.filter((row) => row.soldOut === "Yes");
}

// --- Orders ---

export type OrderExportRow = {
  orderNumber: string;
  date: string;
  customerName: string;
  phone: string;
  email: string;
  region: string;
  city: string;
  address: string;
  products: string;
  total: number;
  paymentMethod: string;
  status: OrderStatus;
  customerType: "Registered" | "Guest";
};

/** Pure row mapping (T308) — resolves every bilingual snapshot field in `locale`, falling back to English (mirrors `resolveLocalizedString` everywhere else in this codebase). */
export function mapOrderRow(order: Order, locale = "en"): OrderExportRow {
  return {
    orderNumber: order.orderNumber,
    date: order.createdAt.toDate().toISOString(),
    customerName: order.customerSnapshot.fullName,
    phone: order.customerSnapshot.phone,
    email: order.customerSnapshot.email,
    region: resolveLocalizedString(order.deliverySnapshot.regionName, locale),
    city: resolveLocalizedString(order.deliverySnapshot.locationName, locale),
    address: order.deliverySnapshot.fullAddress,
    products: order.items
      .map(
        (item) =>
          `${resolveLocalizedString(item.productName, locale)} x${item.quantity} @ ${fromMinorUnits(item.unitPrice).toFixed(2)}`,
      )
      .join("; "),
    total: fromMinorUnits(order.total),
    paymentMethod: order.paymentMethod,
    status: order.status,
    customerType: order.userId ? "Registered" : "Guest",
  };
}

export type OrderExportFilters = {
  from?: Date;
  to?: Date;
  status?: OrderStatus;
  regionId?: string;
};

/**
 * Orders report data (T295, spec FR-102). Server-validated filters are
 * applied to the Firestore query itself, never used to post-filter an
 * already-fetched full dataset (research.md §46). Returns an async
 * generator so the Route Handler can stream rows into the workbook writer
 * as they're read, rather than buffering the whole result set.
 */
export async function* iterateOrderExportRows(filters: OrderExportFilters): AsyncGenerator<OrderExportRow> {
  let query: FirebaseFirestore.Query<Order> = ordersCollection();
  if (filters.from) query = query.where("createdAt", ">=", filters.from);
  if (filters.to) query = query.where("createdAt", "<=", filters.to);
  if (filters.status) query = query.where("status", "==", filters.status);
  if (filters.regionId) query = query.where("deliverySnapshot.regionId", "==", filters.regionId);
  query = query.orderBy("createdAt", "desc");

  const snapshot = await query.get();
  for (const doc of snapshot.docs) {
    yield mapOrderRow(doc.data());
  }
}

// --- Customers ---

export type CustomerExportRow = {
  uid: string;
  name: string;
  email: string;
  phone: string;
  region: string;
  city: string;
  orderCount: number;
  totalSpent: number;
  joinedDate: string;
};

/** Registered-customer profile + order-history summary (T299, spec FR-104) — never a password/credential/token value, since none is ever stored on `User` in the first place. */
export async function getCustomerExportRows(): Promise<CustomerExportRow[]> {
  const [customersSnapshot, ordersSnapshot] = await Promise.all([
    usersCollection().where("role", "==", "CUSTOMER").get(),
    ordersCollection().get(),
  ]);

  const ordersByCustomer = new Map<string, Order[]>();
  for (const doc of ordersSnapshot.docs) {
    const order = doc.data();
    if (!order.userId) continue;
    const existing = ordersByCustomer.get(order.userId) ?? [];
    existing.push(order);
    ordersByCustomer.set(order.userId, existing);
  }

  return customersSnapshot.docs.map((doc) => {
    const customer: User = doc.data();
    const customerOrders = (ordersByCustomer.get(customer.uid) ?? []).filter((o) => o.status !== "CANCELLED");
    return {
      uid: customer.uid,
      name: customer.name,
      email: customer.email,
      phone: customer.phone ?? "",
      region: customer.profile.address?.regionId ?? "",
      city: customer.profile.address?.locationId ?? "",
      orderCount: customerOrders.length,
      totalSpent: fromMinorUnits(customerOrders.reduce((sum, o) => sum + o.total, 0)),
      joinedDate: (customer.createdAt as Timestamp).toDate().toISOString(),
    };
  });
}

// --- Sales & Best Sellers ---

export type DateRangeFilters = { from?: Date; to?: Date };

async function getOrdersInRange(filters: DateRangeFilters): Promise<Order[]> {
  let query: FirebaseFirestore.Query<Order> = ordersCollection();
  if (filters.from) query = query.where("createdAt", ">=", filters.from);
  if (filters.to) query = query.where("createdAt", "<=", filters.to);
  const snapshot = await query.get();
  return snapshot.docs.map((doc) => doc.data());
}

export type SalesExportRow = { metric: string; value: string };

/**
 * Pure computation (T309, unit-testable with no Firestore involved) —
 * calls `computeDashboardStats` (T169) directly rather than recomputing the
 * cancelled-order exclusion a second way, so this can never drift from the
 * dashboard's own figures.
 */
export function computeSalesExportRows(orders: Order[]): SalesExportRow[] {
  const stats = computeDashboardStats(orders, [], 0);
  return [
    { metric: "Total Orders", value: String(stats.totalOrders) },
    { metric: "Total Sales", value: fromMinorUnits(stats.totalSales).toFixed(2) },
    { metric: "Pending Orders", value: String(stats.pendingOrders) },
  ];
}

/** Sales report (T300, spec FR-105) — figures computed identically to the dashboard's own statistics (T169), excluding cancelled orders. */
export async function getSalesExportRows(filters: DateRangeFilters): Promise<SalesExportRow[]> {
  const orders = await getOrdersInRange(filters);
  return computeSalesExportRows(orders);
}

export type BestSellerExportRow = { productId: string; nameEn: string; quantitySold: number };

/** Pure computation (T309) — calls `computeBestSellers` (T169) directly, matching the dashboard's own ranking bit-for-bit. */
export function computeBestSellerExportRows(orders: Order[], products: Product[]): BestSellerExportRow[] {
  return computeBestSellers(orders, products, products.length || 1);
}

/** Best Sellers report (T301, spec FR-105) — ranked by cumulative quantity sold excluding cancelled orders, matching the dashboard's own ranking. */
export async function getBestSellerExportRows(filters: DateRangeFilters): Promise<BestSellerExportRow[]> {
  const [orders, productsSnapshot] = await Promise.all([getOrdersInRange(filters), productsCollection().get()]);
  const products = productsSnapshot.docs.map((doc) => doc.data());
  return computeBestSellerExportRows(orders, products);
}

// --- Delivery Locations ---

export type DeliveryLocationExportRow = {
  region: string;
  city: string;
  active: "Yes" | "No";
  displayOrder: number;
};

/** Delivery Locations report (T302, spec FR-107): every region/city with bilingual name, active state, display order. */
export async function getDeliveryLocationExportRows(): Promise<DeliveryLocationExportRow[]> {
  const regions = await getAllDeliveryRegions();
  const rowsByRegion = await Promise.all(
    regions.map(async (region) => {
      const locations = await getAllDeliveryLocationsByRegion(region.regionId);
      return locations.map(
        (location): DeliveryLocationExportRow => ({
          region: `${region.name.en}${region.name.ar ? ` / ${region.name.ar}` : ""}`,
          city: `${location.name.en}${location.name.ar ? ` / ${location.name.ar}` : ""}`,
          active: location.isActive ? "Yes" : "No",
          displayOrder: location.displayOrder,
        }),
      );
    }),
  );
  return rowsByRegion.flat();
}
