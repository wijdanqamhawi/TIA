import { notFound, redirect } from "next/navigation";
import { getSessionClaims } from "@/lib/firebase/guards";
import { getOrderForCustomer } from "@/lib/domain/orders/order.service";
import { getProductsByIds } from "@/lib/domain/catalog/product.service";
import {
  getActiveDeliveryLocationsByRegion,
  getActiveDeliveryRegions,
} from "@/lib/domain/delivery/deliveryLocation.service";
import { OrderEditView } from "@/components/storefront/checkout/OrderEditView";

// Reads the live order and stock and makes a per-request ownership decision — never cached.
export const dynamic = "force-dynamic";

/**
 * `/[locale]/account/orders/[orderNumber]/edit`: the signed-in customer edits their OWN order while
 * it is still Pending. `getOrderForCustomer` scopes the read to the session uid, so
 * another customer's (or a guest) order renders the same 404 as a missing one. The page only shows
 * the form; `updateCustomerOrderAction` enforces ownership, status, stock and pricing on save.
 */
export default async function EditOrderPage({
  params,
}: {
  params: Promise<{ locale: string; orderNumber: string }>;
}) {
  const { locale, orderNumber } = await params;

  const claims = await getSessionClaims();
  if (!claims) redirect(`/${locale}/login?next=/${locale}/account/orders/${orderNumber}/edit`);

  const order = await getOrderForCustomer(orderNumber, claims.uid);
  if (!order) notFound();

  const [products, regions] = await Promise.all([
    getProductsByIds(order.items.map((item) => item.productId)),
    getActiveDeliveryRegions(),
  ]);

  const thumbnails = Object.fromEntries(
    order.items.map((item) => [
      item.productId,
      products.get(item.productId)?.images[0]?.url ?? null,
    ]),
  );
  // A product that is gone or hidden can't have its quantity raised (only reduced or removed).
  const stockByProduct = Object.fromEntries(
    [...products.entries()]
      .filter(([, product]) => product.availability)
      .map(([id, product]) => [id, product.stock]),
  );

  const locationEntries = await Promise.all(
    regions.map(
      async (region) =>
        [region.regionId, await getActiveDeliveryLocationsByRegion(region.regionId)] as const,
    ),
  );
  const locationsByRegion: Record<
    string,
    Array<{ id: string; name: (typeof order.deliverySnapshot)["locationName"] }>
  > = Object.fromEntries(
    locationEntries.map(([regionId, locations]) => [
      regionId,
      locations.map((location) => ({ id: location.id, name: location.name })),
    ]),
  );
  // The order's current city stays selectable even if it has since been deactivated.
  const current = order.deliverySnapshot;
  const inRegion = (locationsByRegion[current.regionId] ??= []);
  if (!inRegion.some((location) => location.id === current.locationId)) {
    inRegion.push({ id: current.locationId, name: current.locationName });
  }

  return (
    <main className="bg-brand-ivory">
      <OrderEditView
        order={order}
        locale={locale}
        thumbnails={thumbnails}
        stockByProduct={stockByProduct}
        regions={regions.map((region) => ({ id: region.regionId, name: region.name }))}
        locationsByRegion={locationsByRegion}
      />
    </main>
  );
}
