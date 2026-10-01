import { getOfferStatus, type InstantLike, type OfferStatus } from "@/lib/domain/catalog/offer";
import type { Product } from "@/types/product";

/**
 * Pure logic behind the admin Special Offers page. Offers are not a
 * collection of their own: an "offer" is a product whose derived status
 * (`getOfferStatus`, from `isOnSale`/`salePrice`/`saleStartAt`/`saleEndAt`
 * and the current time) is Scheduled, Active or Expired. Nothing here is
 * stored — every figure is derived from the product documents.
 */

/** Every derived status: a switched-off offer keeps its stored details and stays listed as DISABLED. */
export type ListedOfferStatus = OfferStatus;

export type OfferRow = {
  productId: string;
  /** Product name in the admin language (Arabic falls back to English). */
  name: string;
  nameEn: string;
  nameAr: string | null;
  imageUrl: string | null;
  /** Regular price, integer minor units. */
  price: number;
  /** Sale price, integer minor units. */
  salePrice: number;
  status: ListedOfferStatus;
  /** Epoch ms, or `null` for "starts immediately". */
  startAt: number | null;
  /** Epoch ms, or `null` for "no end date". */
  endAt: number | null;
  /** The stored `isOnSale` flag (always true here — a disabled offer is not listed). */
  isOnSale: boolean;
};

/** A product that has no offer yet, offered by the New Offer picker. */
export type OfferProductChoice = { id: string; name: string; price: number };

export type OfferStats = {
  total: number;
  active: number;
  scheduled: number;
  expired: number;
  disabled: number;
};

export type OfferStatusFilter = "all" | ListedOfferStatus;

const STATUS_ORDER: Record<ListedOfferStatus, number> = {
  ACTIVE: 0,
  SCHEDULED: 1,
  EXPIRED: 2,
  DISABLED: 3,
};

export function parseOfferStatusFilter(value: string | undefined): OfferStatusFilter {
  return value === "ACTIVE" || value === "SCHEDULED" || value === "EXPIRED" || value === "DISABLED"
    ? value
    : "all";
}

/** Whole-number percentage off, or `null` when there is nothing to show. */
export function discountPercent(price: number, salePrice: number): number | null {
  if (price <= 0 || salePrice >= price || salePrice < 0) return null;
  return Math.round(((price - salePrice) / price) * 100);
}

function nameFor(product: Product, locale: "en" | "ar"): string {
  return locale === "ar" ? product.name.ar || product.name.en : product.name.en;
}

/**
 * Splits the catalog into the offers and the products still free to receive
 * one. A product HAS an offer while it stores a sale price — so a switched-off
 * offer (`isOnSale: false`, details kept) stays listed as DISABLED and can be
 * started again; a product with no stored sale price is offered to New Offer.
 * Sorted Active, Scheduled, Expired, Disabled.
 */
export function buildOfferData(
  products: Product[],
  now: InstantLike,
  locale: "en" | "ar",
): { offers: OfferRow[]; choices: OfferProductChoice[] } {
  const offers: OfferRow[] = [];
  const choices: OfferProductChoice[] = [];

  for (const product of products) {
    if (product.salePrice == null) {
      choices.push({ id: product.id, name: nameFor(product, locale), price: product.price });
      continue;
    }
    offers.push({
      productId: product.id,
      name: nameFor(product, locale),
      nameEn: product.name.en,
      nameAr: product.name.ar,
      imageUrl: [...product.images].sort((a, b) => a.position - b.position)[0]?.url ?? null,
      price: product.price,
      salePrice: product.salePrice,
      status: getOfferStatus(product, now),
      startAt: product.saleStartAt?.toMillis() ?? null,
      endAt: product.saleEndAt?.toMillis() ?? null,
      isOnSale: product.isOnSale,
    });
  }

  offers.sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name),
  );
  choices.sort((a, b) => a.name.localeCompare(b.name));
  return { offers, choices };
}

export function computeOfferStats(offers: OfferRow[]): OfferStats {
  const count = (status: ListedOfferStatus) =>
    offers.filter((offer) => offer.status === status).length;
  return {
    total: offers.length,
    active: count("ACTIVE"),
    scheduled: count("SCHEDULED"),
    expired: count("EXPIRED"),
    disabled: count("DISABLED"),
  };
}

/** Case-insensitive product-name search (English and Arabic) plus an exact status filter. */
export function filterOffers(
  offers: OfferRow[],
  filters: { query: string; status: OfferStatusFilter },
): OfferRow[] {
  const query = filters.query.trim().toLowerCase();
  return offers.filter((offer) => {
    if (filters.status !== "all" && offer.status !== filters.status) return false;
    if (!query) return true;
    return (
      offer.nameEn.toLowerCase().includes(query) ||
      Boolean(offer.nameAr?.toLowerCase().includes(query))
    );
  });
}

/** An epoch-ms instant as a `datetime-local` input value in the browser's own time zone (as the product form does). */
export function toDateTimeLocalValue(ms: number | null): string {
  if (ms === null) return "";
  const date = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * What clicking an offer's status pill may do. Status stays DERIVED from the
 * stored offer fields — the pill only flips the existing `isOnSale` flag:
 *  - ACTIVE → stop (sets `isOnSale: false`; the sale price and dates are kept);
 *  - DISABLED → start (sets `isOnSale: true`) — but only while the stored offer
 *    is still valid: a sale price below the regular price and an end date that
 *    has not passed. An expired offer is never switched back on; the admin is
 *    sent to Edit Offer to set new dates;
 *  - SCHEDULED / EXPIRED → nothing (they follow their dates).
 */
export type OfferToggle =
  | { kind: "stop" }
  | { kind: "start"; resultingStatus: "ACTIVE" | "SCHEDULED" }
  | { kind: "blocked"; reason: "expired" | "invalidPrice" }
  | { kind: "none" };

export function getOfferToggle(offer: OfferRow, nowMs: number): OfferToggle {
  if (offer.status === "ACTIVE") return { kind: "stop" };
  if (offer.status !== "DISABLED") return { kind: "none" };
  if (offer.salePrice <= 0 || offer.salePrice >= offer.price)
    return { kind: "blocked", reason: "invalidPrice" };
  if (offer.endAt !== null && nowMs >= offer.endAt) return { kind: "blocked", reason: "expired" };
  return {
    kind: "start",
    resultingStatus: offer.startAt !== null && nowMs < offer.startAt ? "SCHEDULED" : "ACTIVE",
  };
}

/**
 * The payload a status change sends to the existing `updateProductAction`. Stopping sends only the
 * flag (the update schema keeps every omitted field). Starting also repeats the stored sale price,
 * because the schema requires a sale price whenever `isOnSale` is true; dates are left alone.
 */
export function offerToggleInput(
  offer: OfferRow,
  toggle: Extract<OfferToggle, { kind: "stop" | "start" }>,
): { productId: string; isOnSale: boolean; salePrice?: number } {
  return toggle.kind === "stop"
    ? { productId: offer.productId, isOnSale: false }
    : { productId: offer.productId, isOnSale: true, salePrice: offer.salePrice };
}
