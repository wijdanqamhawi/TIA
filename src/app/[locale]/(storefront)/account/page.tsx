import { getTranslations } from "next-intl/server";
import { getSessionClaims } from "@/lib/firebase/guards";
import { usersCollection } from "@/lib/firebase/firestore";
import { getActiveDeliveryRegions, getActiveDeliveryLocationsByRegion } from "@/lib/domain/delivery/deliveryLocation.service";
import { isDeliveryRegionId, type DeliveryRegionId } from "@/types/deliveryRegion";
import { Link } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { ProfileForm } from "@/components/storefront/ProfileForm";
import { PageHeading } from "@/components/ui/PageHeading";

// Reads the caller's live profile + delivery-region data on every
// request; `AccountLayout` already guards this route (Constitution
// Principle 7/9).
export const dynamic = "force-dynamic";

/**
 * The `/[locale]/account` overview + profile-edit page (T135, spec User
 * Story 2). `AccountLayout` guarantees a verified session by the time
 * this renders, so `claims` is never null here.
 */
export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Account" });

  const claims = await getSessionClaims();
  const userDoc = await usersCollection().doc(claims!.uid).get();
  const user = userDoc.data()!;

  const address = user.profile.address;
  const [regions, initialLocations] = await Promise.all([
    getActiveDeliveryRegions(),
    address && isDeliveryRegionId(address.regionId)
      ? getActiveDeliveryLocationsByRegion(address.regionId as DeliveryRegionId)
      : Promise.resolve([]),
  ]);

  const regionOptions = regions.map((region) => ({ id: region.regionId, name: region.name }));
  const locationOptions = initialLocations.map((location) => ({
    id: location.id,
    name: location.name,
    slug: location.slug,
  }));

  return (
    <main className="container-luxury py-14 sm:py-20">
      <PageHeading title={t("title")} className="mb-10 sm:mb-14" />

      <div className="mx-auto flex max-w-2xl flex-col gap-8">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/account/orders" className="flex-1">
            <Button type="button" variant="outline" className="w-full">
              {t("viewOrders")}
            </Button>
          </Link>
          <Link href="/wishlist" className="flex-1">
            <Button type="button" variant="outline" className="w-full">
              {t("viewWishlist")}
            </Button>
          </Link>
        </div>

        <ProfileForm
          locale={locale}
          email={user.email}
          initialName={user.name}
          initialPhone={user.phone ?? ""}
          initialAddress={address}
          regions={regionOptions}
          initialLocations={locationOptions}
        />
      </div>
    </main>
  );
}
