import type { Timestamp } from "firebase-admin/firestore";
import type { LocalizedString } from "./localizedString";

export type ProductImage = {
  url: string;
  storagePath: string;
  position: number;
  alt: string;
  /**
   * Optional link to one of the product's option *values* (e.g. the `gold`
   * value of its `color` option). When a product has images carrying a
   * `valueKey`, the detail gallery shows only those matching the shopper's
   * selected value, so choosing a colour swaps the photography.
   *
   * Absent on every image of every product that has no per-variant
   * photography — those galleries show all images exactly as before. This
   * is the only field added for variant imagery: an image belongs to a
   * value, rather than variants being a new entity of their own.
   */
  valueKey?: string | null;
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
