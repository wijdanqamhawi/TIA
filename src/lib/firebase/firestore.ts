import "server-only";
import type { FirestoreDataConverter, QueryDocumentSnapshot } from "firebase-admin/firestore";
import { getAdminFirestore } from "./admin";
import type { User } from "@/types/user";
import type { Category } from "@/types/category";
import type { Product, ProductImage, ProductOption } from "@/types/product";
import type { CategoryShowcase } from "@/types/categoryShowcase";
import type { LocalizedString } from "@/types/localizedString";
import type { Cart, CartItem } from "@/types/cart";
import type { Wishlist, WishlistItem } from "@/types/wishlist";
import type { DeliveryRegion } from "@/types/deliveryRegion";
import type { DeliveryLocation } from "@/types/deliveryLocation";
import type { Order, OrderItem } from "@/types/order";
import { toUserRole } from "@/lib/auth/roles";

/**
 * Builds a typed `FirestoreDataConverter<T>` from plain `toFirestore`/
 * `fromFirestore` mapping functions, so every collection reference below
 * always reads/writes a typed domain object — never a raw, untyped
 * `DocumentData` (Constitution Principle 12).
 *
 * Per-entity converters (users, products, categories, carts, orders, …)
 * are added in later phases as those entities' Zod schemas/types exist;
 * this file establishes the shared foundation they all build on.
 */
export function createConverter<T extends { id: string }>(
  toFirestoreData: (data: T) => FirebaseFirestore.DocumentData,
  fromFirestoreData: (id: string, data: FirebaseFirestore.DocumentData) => T,
): FirestoreDataConverter<T> {
  return {
    toFirestore(model: T) {
      return toFirestoreData(model);
    },
    fromFirestore(snapshot: QueryDocumentSnapshot) {
      return fromFirestoreData(snapshot.id, snapshot.data());
    },
  };
}

export function typedCollection<T extends { id: string }>(
  path: string,
  converter: FirestoreDataConverter<T>,
) {
  return getAdminFirestore().collection(path).withConverter(converter);
}

export { getAdminFirestore };

// --- users/{uid} (data-model.md) ---

export const usersConverter: FirestoreDataConverter<User> = createConverter<User>(
  (user) => ({
    uid: user.uid,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    profile: user.profile,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }),
  (id, data) => ({
    id,
    uid: data.uid,
    name: data.name,
    email: data.email,
    phone: data.phone ?? null,
    role: toUserRole(data.role),
    profile: data.profile ?? { address: null },
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }),
);

export function usersCollection() {
  return typedCollection<User>("users", usersConverter);
}

function readLocalizedString(value: FirebaseFirestore.DocumentData[string]): LocalizedString {
  return { en: value?.en ?? "", ar: value?.ar ?? null };
}

function readNullableLocalizedString(
  value: FirebaseFirestore.DocumentData[string] | null | undefined,
): LocalizedString | null {
  return value ? readLocalizedString(value) : null;
}

// --- categories/{categoryId} (data-model.md) ---

export const categoriesConverter: FirestoreDataConverter<Category> = createConverter<Category>(
  (category) => ({
    name: category.name,
    slug: category.slug,
    description: category.description,
    displayOrder: category.displayOrder,
    isActive: category.isActive,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  }),
  (id, data) => ({
    id,
    name: readLocalizedString(data.name),
    slug: data.slug,
    description: readNullableLocalizedString(data.description),
    displayOrder: data.displayOrder ?? 0,
    isActive: data.isActive ?? true,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }),
);

export function categoriesCollection() {
  return typedCollection<Category>("categories", categoriesConverter);
}

// --- products/{productId} (data-model.md) ---

function readProductImages(value: FirebaseFirestore.DocumentData["images"]): ProductImage[] {
  return Array.isArray(value)
    ? value.map((image) => ({
        url: image.url,
        storagePath: image.storagePath,
        position: image.position ?? 0,
        alt: image.alt ?? "",
        // Per-variant photography (see `ProductImage.valueKey`). This
        // converter rebuilds each image field-by-field, so an image field
        // missing from this list is silently dropped on *every* read no
        // matter what is stored — which is exactly what happened when
        // `valueKey` was first added and the gallery never saw it.
        // Normalized to null so a stored `undefined` and an absent field
        // are indistinguishable downstream.
        valueKey: image.valueKey ?? null,
      }))
    : [];
}

function readProductOptions(value: FirebaseFirestore.DocumentData["options"]): ProductOption[] {
  return Array.isArray(value)
    ? value.map((option) => ({
        key: option.key,
        name: readLocalizedString(option.name),
        values: Array.isArray(option.values)
          ? option.values.map((v: { key: string; label: FirebaseFirestore.DocumentData[string] }) => ({
              key: v.key,
              label: readLocalizedString(v.label),
            }))
          : [],
      }))
    : [];
}

export const productsConverter: FirestoreDataConverter<Product> = createConverter<Product>(
  (product) => ({
    name: product.name,
    slug: product.slug,
    description: product.description,
    price: product.price,
    categoryId: product.categoryId,
    images: product.images,
    material: product.material,
    options: product.options,
    stock: product.stock,
    availability: product.availability,
    isNewArrival: product.isNewArrival,
    isBestSeller: product.isBestSeller,
    salesCount: product.salesCount,
    searchTerms: product.searchTerms,
    isOnSale: product.isOnSale,
    salePrice: product.salePrice,
    saleStartAt: product.saleStartAt,
    saleEndAt: product.saleEndAt,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  }),
  (id, data) => ({
    id,
    name: readLocalizedString(data.name),
    slug: data.slug,
    description: readLocalizedString(data.description),
    price: data.price,
    categoryId: data.categoryId,
    images: readProductImages(data.images),
    material: readLocalizedString(data.material),
    options: readProductOptions(data.options),
    stock: data.stock ?? 0,
    availability: data.availability ?? false,
    isNewArrival: data.isNewArrival ?? false,
    isBestSeller: data.isBestSeller ?? false,
    salesCount: data.salesCount ?? 0,
    searchTerms: Array.isArray(data.searchTerms) ? data.searchTerms : [],
    isOnSale: data.isOnSale ?? false,
    salePrice: data.salePrice ?? null,
    saleStartAt: data.saleStartAt ?? null,
    saleEndAt: data.saleEndAt ?? null,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }),
);

export function productsCollection() {
  return typedCollection<Product>("products", productsConverter);
}

// --- categoryShowcases/{showcaseId} (data-model.md, spec FR-001a–FR-001f) ---

export const categoryShowcasesConverter: FirestoreDataConverter<CategoryShowcase> =
  createConverter<CategoryShowcase>(
    (showcase) => ({
      categoryId: showcase.categoryId,
      desktopImage: showcase.desktopImage,
      mobileImage: showcase.mobileImage,
      title: showcase.title,
      subtitle: showcase.subtitle,
      cta: showcase.cta,
      displayOrder: showcase.displayOrder,
      isActive: showcase.isActive,
      createdAt: showcase.createdAt,
      updatedAt: showcase.updatedAt,
    }),
    (id, data) => ({
      id,
      categoryId: data.categoryId,
      desktopImage: data.desktopImage,
      mobileImage: data.mobileImage ?? null,
      title: readLocalizedString(data.title),
      subtitle: readNullableLocalizedString(data.subtitle),
      cta: readLocalizedString(data.cta),
      displayOrder: data.displayOrder ?? 0,
      isActive: data.isActive ?? true,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    }),
  );

export function categoryShowcasesCollection() {
  return typedCollection<CategoryShowcase>("categoryShowcases", categoryShowcasesConverter);
}

// --- carts/{uid} and guestCarts/{guestCartId} (data-model.md) ---
// Two collections sharing one document shape, kept separate so a
// Firestore TTL policy on `guestCarts.expiresAt` can never expire a
// registered customer's cart (research.md §5).

function readCartItems(value: FirebaseFirestore.DocumentData["items"]): CartItem[] {
  return Array.isArray(value)
    ? value.map((item) => ({
        productId: item.productId,
        selectedOption: item.selectedOption
          ? { optionKey: item.selectedOption.optionKey, valueKey: item.selectedOption.valueKey }
          : null,
        quantity: item.quantity,
      }))
    : [];
}

function cartConverter(): FirestoreDataConverter<Cart> {
  return createConverter<Cart>(
    (cart) => ({
      items: cart.items,
      expiresAt: cart.expiresAt,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
    }),
    (id, data) => ({
      id,
      items: readCartItems(data.items),
      expiresAt: data.expiresAt ?? null,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    }),
  );
}

export const cartsConverter = cartConverter();
export const guestCartsConverter = cartConverter();

export function cartsCollection() {
  return typedCollection<Cart>("carts", cartsConverter);
}

export function guestCartsCollection() {
  return typedCollection<Cart>("guestCarts", guestCartsConverter);
}

// --- wishlists/{uid} (data-model.md) ---
// Registered-customer-only — deliberately no guest-wishlist collection
// mirroring guestCarts (spec FR-033a).

function readWishlistItems(value: FirebaseFirestore.DocumentData["items"]): WishlistItem[] {
  return Array.isArray(value)
    ? value.map((item) => ({
        productId: item.productId,
        selectedOption: item.selectedOption
          ? { optionKey: item.selectedOption.optionKey, valueKey: item.selectedOption.valueKey }
          : null,
        addedAt: item.addedAt,
      }))
    : [];
}

export const wishlistsConverter: FirestoreDataConverter<Wishlist> = createConverter<Wishlist>(
  (wishlist) => ({
    items: wishlist.items,
    createdAt: wishlist.createdAt,
    updatedAt: wishlist.updatedAt,
  }),
  (id, data) => ({
    id,
    items: readWishlistItems(data.items),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }),
);

export function wishlistsCollection() {
  return typedCollection<Wishlist>("wishlists", wishlistsConverter);
}

// --- deliveryRegions/{regionId} and deliveryLocations/{locationId} (data-model.md, Phase 8 checkout prerequisite) ---

export const deliveryRegionsConverter: FirestoreDataConverter<DeliveryRegion> = createConverter<DeliveryRegion>(
  (region) => ({
    regionId: region.regionId,
    name: region.name,
    displayOrder: region.displayOrder,
    isActive: region.isActive,
    createdAt: region.createdAt,
    updatedAt: region.updatedAt,
  }),
  (id, data) => ({
    id,
    regionId: data.regionId,
    name: readLocalizedString(data.name),
    displayOrder: data.displayOrder ?? 0,
    isActive: data.isActive ?? true,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }),
);

export function deliveryRegionsCollection() {
  return typedCollection<DeliveryRegion>("deliveryRegions", deliveryRegionsConverter);
}

export const deliveryLocationsConverter: FirestoreDataConverter<DeliveryLocation> =
  createConverter<DeliveryLocation>(
    (location) => ({
      regionId: location.regionId,
      name: location.name,
      slug: location.slug,
      searchTerms: location.searchTerms,
      displayOrder: location.displayOrder,
      isActive: location.isActive,
      createdAt: location.createdAt,
      updatedAt: location.updatedAt,
    }),
    (id, data) => ({
      id,
      regionId: data.regionId,
      name: readLocalizedString(data.name),
      slug: data.slug,
      searchTerms: Array.isArray(data.searchTerms) ? data.searchTerms : [],
      displayOrder: data.displayOrder ?? 0,
      isActive: data.isActive ?? true,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    }),
  );

export function deliveryLocationsCollection() {
  return typedCollection<DeliveryLocation>("deliveryLocations", deliveryLocationsConverter);
}

// --- orders/{orderId} (data-model.md, Phase 8) ---

function readOrderItems(value: FirebaseFirestore.DocumentData["items"]): OrderItem[] {
  return Array.isArray(value)
    ? value.map((item) => ({
        productId: item.productId,
        productName: readLocalizedString(item.productName),
        selectedOption: item.selectedOption
          ? {
              optionKey: item.selectedOption.optionKey,
              valueKey: item.selectedOption.valueKey,
              label: readLocalizedString(item.selectedOption.label),
            }
          : null,
        unitPrice: item.unitPrice,
        originalPrice: item.originalPrice,
        wasOnSale: Boolean(item.wasOnSale),
        quantity: item.quantity,
      }))
    : [];
}

export const ordersConverter: FirestoreDataConverter<Order> = createConverter<Order>(
  (order) => ({
    orderNumber: order.orderNumber,
    userId: order.userId,
    customerSnapshot: order.customerSnapshot,
    deliverySnapshot: order.deliverySnapshot,
    items: order.items,
    notes: order.notes,
    paymentMethod: order.paymentMethod,
    status: order.status,
    subtotal: order.subtotal,
    total: order.total,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  }),
  (id, data) => ({
    id,
    orderNumber: data.orderNumber,
    userId: data.userId ?? null,
    customerSnapshot: {
      fullName: data.customerSnapshot.fullName,
      email: data.customerSnapshot.email,
      phone: data.customerSnapshot.phone,
    },
    deliverySnapshot: {
      regionId: data.deliverySnapshot.regionId,
      regionName: readLocalizedString(data.deliverySnapshot.regionName),
      locationId: data.deliverySnapshot.locationId,
      locationName: readLocalizedString(data.deliverySnapshot.locationName),
      fullAddress: data.deliverySnapshot.fullAddress,
    },
    items: readOrderItems(data.items),
    notes: data.notes ?? null,
    paymentMethod: data.paymentMethod,
    status: data.status,
    subtotal: data.subtotal,
    total: data.total,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }),
);

export function ordersCollection() {
  return typedCollection<Order>("orders", ordersConverter);
}

// --- counters/order-{YYYYMMDD} and stats/summary (data-model.md, research.md §4/§17b) ---
// Tiny internal documents with no rich domain type elsewhere — still given
// typed converters (never raw untyped DocumentData), consistent with every
// other collection above.

export type OrderCounter = { id: string; seq: number };

const orderCounterConverter: FirestoreDataConverter<OrderCounter> = createConverter<OrderCounter>(
  (counter) => ({ seq: counter.seq }),
  (id, data) => ({ id, seq: data.seq ?? 0 }),
);

/** `counters/order-{dateKey}`, e.g. `counters/order-20260827` — one per calendar day (UTC), research.md §4. */
export function orderCounterDoc(dateKey: string) {
  return getAdminFirestore().collection("counters").doc(`order-${dateKey}`).withConverter(orderCounterConverter);
}

export type StatsSummary = { id: string; totalSales: number; totalOrders: number };

const statsSummaryConverter: FirestoreDataConverter<StatsSummary> = createConverter<StatsSummary>(
  (stats) => ({ totalSales: stats.totalSales, totalOrders: stats.totalOrders }),
  (id, data) => ({ id, totalSales: data.totalSales ?? 0, totalOrders: data.totalOrders ?? 0 }),
);

/** `stats/summary` — a single denormalized document (research.md §17b). */
export function statsSummaryDoc() {
  return getAdminFirestore().collection("stats").doc("summary").withConverter(statsSummaryConverter);
}
