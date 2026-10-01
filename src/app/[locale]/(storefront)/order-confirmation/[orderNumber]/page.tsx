import { notFound } from "next/navigation";
import { getOrderByNumber } from "@/lib/domain/orders/order.service";
import { getSessionClaims } from "@/lib/firebase/guards";
import { hasGuestOrderAccess } from "@/lib/domain/orders/guest-order-access";
import { isOrderEditable } from "@/lib/domain/orders/order-edit-rules";
import { getProductsByIds } from "@/lib/domain/catalog/product.service";
import { OrderConfirmationView } from "@/components/storefront/checkout/OrderConfirmationView";

// Reads live order data and makes a per-request access decision — never
// statically cached.
export const dynamic = "force-dynamic";

/**
 * `/[locale]/order-confirmation/[orderNumber]` (T126, spec: bilingual
 * order number, product names, quantities, total, payment method,
 * delivery region/city). Access is restricted to the order's own owner —
 * the signed-in customer whose `uid` matches `order.userId`, or (for a
 * guest order) the browser holding the matching signed guest-order-access
 * cookie set right after checkout (`guest-order-access.ts`) — so a
 * sequential, guessable order number can never be used to view another
 * customer's name/phone/address/order contents (Constitution Principle
 * 6). An unauthorized or nonexistent order both render the same 404,
 * never revealing which case it was.
 */
export default async function OrderConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; orderNumber: string }>;
  searchParams: Promise<{ updated?: string }>;
}) {
  const { locale, orderNumber } = await params;
  const { updated } = await searchParams;
  const order = await getOrderByNumber(orderNumber);
  if (!order) {
    notFound();
  }

  const claims = await getSessionClaims();
  const isOwner = Boolean(claims && order.userId === claims.uid);
  const hasGuestAccess = !order.userId && (await hasGuestOrderAccess(orderNumber));

  if (!isOwner && !hasGuestAccess) {
    notFound();
  }

  // Orders store no product image, so the thumbnails are read live — one batched read, photos only;
  // every price and total shown comes from the stored order.
  const products = await getProductsByIds(order.items.map((item) => item.productId));
  const thumbnails = Object.fromEntries(
    order.items.map((item) => [
      item.productId,
      products.get(item.productId)?.images[0]?.url ?? null,
    ]),
  );

  return (
    <main className="bg-brand-ivory">
      <OrderConfirmationView
        order={order}
        locale={locale}
        thumbnails={thumbnails}
        // Only the signed-in owner of a still-editable order sees Edit Order; the action re-checks on save.
        editable={isOwner && isOrderEditable(order.status)}
        justUpdated={updated === "1"}
      />
    </main>
  );
}
