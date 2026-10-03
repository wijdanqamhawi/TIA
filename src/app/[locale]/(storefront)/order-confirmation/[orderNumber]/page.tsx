import { notFound } from "next/navigation";
import { getOrderByNumber } from "@/lib/domain/orders/order.service";
import { getSessionClaims } from "@/lib/firebase/guards";
import { hasGuestOrderAccess } from "@/lib/domain/orders/guest-order-access";
import { decideOrderAccess } from "@/lib/domain/orders/order-access";
import { logger } from "@/lib/utils/logger";
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
    logger.warn("order-confirmation: 404", { orderNumber, reason: "order_not_found" });
    notFound();
  }

  const claims = await getSessionClaims();
  const hasGuestAccess = !order.userId && (await hasGuestOrderAccess(orderNumber));
  const access = decideOrderAccess(order, claims, hasGuestAccess);

  if (!access.allowed) {
    // Diagnostics only (no uid/cookie/token): the viewer's role, never their identity.
    logger.warn("order-confirmation: 404", {
      orderNumber,
      reason: access.reason,
      signedIn: Boolean(claims),
      viewerRole: claims?.role ?? null,
      orderIsGuest: !order.userId,
    });
    notFound();
  }
  const isOwner = access.isOwner;

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
