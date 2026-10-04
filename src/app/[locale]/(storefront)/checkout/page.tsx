import { redirect } from "next/navigation";
import { getCartForDisplay, buildCartSummary } from "@/lib/domain/cart/cart.service";
import {
  getActiveDeliveryRegions,
  getActiveDeliveryLocationsByRegion,
} from "@/lib/domain/delivery/deliveryLocation.service";
import { readLocationSelection } from "@/lib/domain/delivery/location-cookie";
import { getSessionClaims } from "@/lib/firebase/guards";
import { usersCollection } from "@/lib/firebase/firestore";
import { buildCheckoutPrefill } from "@/lib/domain/account/user-phone";
import { CheckoutView } from "@/components/storefront/checkout/CheckoutView";

// Reads the caller's live cart + current product pricing/stock/offer
// state, and live delivery-region data, on every request — never
// statically cached (Constitution Principle 7/9/10).
export const dynamic = "force-dynamic";

/**
 * The `/[locale]/checkout` page (T125/T127, spec FR-077/FR-091): supports
 * both guest and registered checkout identically. Redirects away if the
 * cart is empty (T127) or has unresolved issues (a Sold Out/removed item
 * — the shopper must fix those on the cart page first, mirroring the cart
 * page's own "Proceed to Checkout" gating). Every price shown here is the
 * same live, current effective price `buildCartSummary` already computes
 * for the cart page — never a value cached from when the item was added.
 */
export default async function CheckoutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  const cart = await getCartForDisplay();
  const summary = cart
    ? await buildCartSummary(cart)
    : { lines: [], subtotal: 0, total: 0, hasIssues: false, isEmpty: true };

  if (summary.isEmpty || summary.hasIssues) {
    redirect(`/${locale}/${summary.isEmpty ? "shop" : "cart"}`);
  }

  const [regions, claims, prefillLocation] = await Promise.all([
    getActiveDeliveryRegions(),
    getSessionClaims(),
    readLocationSelection(),
  ]);

  let prefill = buildCheckoutPrefill(null);
  if (claims) {
    const userDoc = await usersCollection().doc(claims.uid).get();
    if (userDoc.exists) prefill = buildCheckoutPrefill(userDoc.data()!);
    // The session email is always present for a signed-in customer, even if the profile doc is missing/blank.
    if (!prefill.email && claims.email) prefill = { ...prefill, email: claims.email };
  }

  const regionOptions = regions.map((region) => ({ id: region.regionId, name: region.name }));

  // Full location data for every region, so `LocationSelectorDialog`
  // (T279 — "change location before submitting") never needs an extra
  // round trip when the customer reopens it from checkout, and so an
  // initial prefill (T271's persisted cookie) can resolve immediately.
  const locationsByRegionEntries = await Promise.all(
    regions.map(
      async (region) =>
        [region.regionId, await getActiveDeliveryLocationsByRegion(region.regionId)] as const,
    ),
  );
  const locationsByRegionForDialog = Object.fromEntries(
    locationsByRegionEntries.map(([regionId, locations]) => [
      regionId,
      locations.map((location) => ({
        id: location.id,
        name: location.name,
        slug: location.slug,
        searchTerms: location.searchTerms,
      })),
    ]),
  );

  return (
    <CheckoutView
      locale={locale}
      summary={summary}
      regionOptions={regionOptions}
      prefill={prefill}
      prefillLocation={prefillLocation}
      locationsByRegionForDialog={locationsByRegionForDialog}
    />
  );
}
