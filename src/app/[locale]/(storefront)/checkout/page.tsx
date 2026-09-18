import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCartForDisplay, buildCartSummary } from "@/lib/domain/cart/cart.service";
import { getActiveDeliveryRegions, getActiveDeliveryLocationsByRegion } from "@/lib/domain/delivery/deliveryLocation.service";
import { readLocationSelection } from "@/lib/domain/delivery/location-cookie";
import { getSessionClaims } from "@/lib/firebase/guards";
import { usersCollection } from "@/lib/firebase/firestore";
import { resolveLocalizedString } from "@/types/localizedString";
import { CheckoutForm } from "@/components/storefront/CheckoutForm";
import { Price } from "@/components/ui/Price";
import { PageHeading } from "@/components/ui/PageHeading";

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
  const t = await getTranslations({ locale, namespace: "Checkout" });

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

  let prefill = { fullName: "", email: "", phone: "" };
  if (claims) {
    const userDoc = await usersCollection().doc(claims.uid).get();
    if (userDoc.exists) {
      const user = userDoc.data()!;
      prefill = { fullName: user.name, email: user.email, phone: user.phone ?? "" };
    }
  }

  const regionOptions = regions.map((region) => ({ id: region.regionId, name: region.name }));

  // Full location data for every region, so `LocationSelectorDialog`
  // (T279 — "change location before submitting") never needs an extra
  // round trip when the customer reopens it from checkout, and so an
  // initial prefill (T271's persisted cookie) can resolve immediately.
  const locationsByRegionEntries = await Promise.all(
    regions.map(async (region) => [region.regionId, await getActiveDeliveryLocationsByRegion(region.regionId)] as const),
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
    <main className="container-luxury py-14 sm:py-20">
      <PageHeading title={t("title")} className="mb-10 sm:mb-14" />

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-3 lg:gap-12">
        <div className="lg:col-span-2">
          <CheckoutForm
            locale={locale}
            regions={regionOptions}
            prefill={prefill}
            prefillLocation={prefillLocation}
            locationsByRegionForDialog={locationsByRegionForDialog}
          />
        </div>

        <div className="flex h-fit flex-col gap-4 rounded-2xl border border-hairline bg-brand-cream/50 p-6 shadow-elev-1 sm:p-7 lg:sticky lg:top-28">
          <h2 className="font-display text-xl text-text-primary">{t("orderSummary")}</h2>
          <div className="flex flex-col gap-2 border-b border-hairline pb-4">
            {summary.lines.map((line) => (
              <div
                key={`${line.productId}:${line.selectedOption?.optionKey ?? ""}:${line.selectedOption?.valueKey ?? ""}`}
                className="flex items-center justify-between gap-2 text-sm text-text-primary"
              >
                <span className="flex-1">
                  {line.product ? resolveLocalizedString(line.product.name, locale) : null} × {line.quantity}
                </span>
                <Price minorUnits={line.lineTotal} locale={locale} className="text-sm" />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between text-sm text-text-primary">
            <span>{t("subtotal")}</span>
            <Price minorUnits={summary.subtotal} locale={locale} className="text-sm" />
          </div>
          <div className="flex items-center justify-between border-t border-hairline pt-4 text-base font-semibold text-text-primary">
            <span>{t("total")}</span>
            <Price minorUnits={summary.total} locale={locale} className="text-xl" />
          </div>
        </div>
      </div>
    </main>
  );
}
