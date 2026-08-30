import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getOrderByNumber } from "@/lib/domain/orders/order.service";
import { getSessionClaims } from "@/lib/firebase/guards";
import { hasGuestOrderAccess } from "@/lib/domain/orders/guest-order-access";
import { Link } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { OrderDetailCard } from "@/components/storefront/OrderDetailCard";

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
}: {
  params: Promise<{ locale: string; orderNumber: string }>;
}) {
  const { locale, orderNumber } = await params;
  const t = await getTranslations({ locale, namespace: "OrderConfirmation" });

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

  return (
    <main className="container-luxury max-w-2xl py-10">
      <div className="text-center">
        <h1 className="font-display text-3xl text-text-primary">{t("title")}</h1>
        <p className="mt-2 text-text-primary/70">{t("thankYou")}</p>
      </div>

      <div className="mt-8">
        <OrderDetailCard order={order} locale={locale} />
      </div>

      <div className="mt-6 text-center">
        <Link href="/shop">
          <Button type="button">{t("continueShopping")}</Button>
        </Link>
      </div>
    </main>
  );
}
