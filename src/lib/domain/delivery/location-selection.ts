import { isDeliveryRegionId, type DeliveryRegionId } from "@/types/deliveryRegion";

/**
 * Location-selection persistence (T271, research.md §41) — mirrors the
 * `NEXT_LOCALE` cookie pattern: a plain, non-`httpOnly` cookie (readable
 * and settable directly from the client, via `document.cookie` in
 * `LocationSelectorDialog`) rather than the signed/`httpOnly` guest-cart
 * cookie pattern. That stronger pattern exists specifically because a
 * guest cart's *contents* are the sensitive value being protected; a
 * location selection is just a UI convenience/prefill — its value is
 * always fully re-validated against live, authoritative Firestore data
 * inside the order-creation transaction (T277) before an order can ever
 * be created, so client-tamperability of this cookie carries no
 * integrity risk (the same reasoning `NEXT_LOCALE` itself relies on).
 *
 * No `server-only` tag here — every export is a pure, side-effect-free
 * string helper used from both a Server Component (`readLocationSelection`
 * in `location-cookie.ts`) and a Client Component (`LocationSelectorDialog`
 * writes `document.cookie` directly).
 */
export const LOCATION_COOKIE_NAME = "elora_location";
const LOCATION_COOKIE_MAX_AGE_SECONDS = 180 * 24 * 60 * 60; // ~6 months

export type LocationSelection = { regionId: DeliveryRegionId; locationId: string };

/** Encodes a selection as the cookie's string value (`regionId:locationId`). */
export function encodeLocationSelection(selection: LocationSelection): string {
  return `${selection.regionId}:${selection.locationId}`;
}

/** Decodes a raw cookie value back into a selection, or `null` if malformed. */
export function decodeLocationSelection(value: string): LocationSelection | null {
  const separatorIndex = value.indexOf(":");
  if (separatorIndex <= 0) return null;

  const regionId = value.slice(0, separatorIndex);
  const locationId = value.slice(separatorIndex + 1);
  if (!isDeliveryRegionId(regionId) || !locationId) return null;

  return { regionId, locationId };
}

/** The `document.cookie` attribute string a client component should append after `=<value>`. */
export const LOCATION_COOKIE_CLIENT_ATTRIBUTES = `; path=/; max-age=${LOCATION_COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
