import type { Timestamp } from "firebase-admin/firestore";
import type { LocalizedString } from "./localizedString";

export type ProductImage = {
  url: string;
  storagePath: string;
  position: number;
  alt: string;
};

export type ProductOptionValue = {
  key: string;
  label: LocalizedString;
};

export type ProductOption = {
  key: string;
  name: LocalizedString;
  values: ProductOptionValue[];
};

/**
 * `products/{productId}` (data-model.md). `stock`/`price`/`categoryId`/
 * `slug`/option `key`s are strictly language-independent; only display
 * text (`name`/`description`/`material`/option `label`s) is bilingual.
 *
 * "Sold Out" is intentionally NOT a field here — it is always derived at
 * read time as `stock === 0` (see `isSoldOut` in `product.service.ts`),
 * never stored, so it can never drift out of sync with the real stock
 * number (spec FR-015a, Constitution Principle 10).
 */
export type Product = {
  id: string; // mirrors `productId`
  name: LocalizedString;
  slug: string;
  description: LocalizedString;
  price: number; // integer minor units, > 0
  categoryId: string;
  images: ProductImage[];
  material: LocalizedString;
  options: ProductOption[];
  stock: number; // integer >= 0
  availability: boolean; // admin-controlled storefront visibility — independent of stock
  isNewArrival: boolean;
  isBestSeller: boolean;
  salesCount: number;
  searchTerms: string[];
  isOnSale: boolean;
  salePrice: number | null;
  saleStartAt: Timestamp | null;
  saleEndAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
