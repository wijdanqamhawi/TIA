import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSessionClaims } from "@/lib/firebase/guards";
import { getOrderForCustomer } from "@/lib/domain/orders/order.service";
import { Link } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { OrderDetailCard } from "@/components/storefront/OrderDetailCard";

// Reads live order data and makes a per-request ownership decision;
// `AccountLayout` already guards this route, and `getOrderForCustomer`
// additionally re-scopes the read itself.
export const dynamic = "force-dynamic";

/**
 * `/[locale]/account/orders/[orderNumber]` (T138, spec User Story 2):
 * full order detail, including the current localized status (T139 — the
 * stored `status` is a language-independent enum value, always read live
 * from Firestore; only its display label comes from the message catalog)
 * and purchase-time prices from the immutable `OrderItem` snapshots
 * (`OrderDetailCard`).
 *
 * `getOrderForCustomer` returns `null` both when the order doesn't exist
 * and when it exists but belongs to another customer — this page renders
 * the identical 404 either way, so a customer can never distinguish "not
 * found" from "not yours" for another customer's order number
 * (Constitution Principle 6, this task's explicit customer-isolation
 * requirement).
 */
export default async function AccountOrderDetailPage({
  params,
}: {
  params: Promise<{ locale: string; orderNumber: string }>;
}) {
  const { locale, orderNumber } = await params;
  const t = await getTranslations({ locale, namespace: "AccountOrders" });
  const tConfirmation = await getTranslations({ locale, namespace: "OrderConfirmation" });

  const claims = await getSessionClaims();
  // Layout and page render in parallel (Next.js 15), so the page cannot
  // rely on `AccountLayout`'s redirect having already run: guard here too.
  if (!claims) redirect(`/${locale}/login?next=/${locale}/account`);
  const order = await getOrderForCustomer(orderNumber, claims.uid);

  if (!order) {
    return (
      <main className="container-luxury max-w-2xl py-16 text-center">
        <h1 className="font-display text-2xl text-text-primary">{tConfirmation("notFoundTitle")}</h1>
        <p className="mt-2 text-text-primary/70">{tConfirmation("notFoundDescription")}</p>
        <Link href="/account/orders" className="mt-6 inline-block">
          <Button type="button">{t("backToOrders")}</Button>
        </Link>
      </main>
    );
  }

  return (
    <main className="container-luxury max-w-2xl py-10">
      <h1 className="mb-6 text-center font-display text-3xl text-text-primary">{t("orderDetailTitle")}</h1>

      <OrderDetailCard order={order} locale={locale} />

      <div className="mt-6 text-center">
        <Link href="/account/orders">
          <Button type="button" variant="outline">
            {t("backToOrders")}
          </Button>
        </Link>
      </div>
    </main>
  );
}
