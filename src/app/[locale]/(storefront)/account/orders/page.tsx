import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSessionClaims } from "@/lib/firebase/guards";
import { getOrdersForCustomer, toOrderSummary } from "@/lib/domain/orders/order.service";
import { EmptyState } from "@/components/ui/EmptyState";
import { OrderHistoryList } from "@/components/storefront/OrderHistoryList";

// Reads the caller's live order history on every request; `AccountLayout`
// already guards this route.
export const dynamic = "force-dynamic";

/**
 * `/[locale]/account/orders` (T137, spec User Story 2): order number,
 * date, total, and current localized status per order — scoped to the
 * signed-in customer's own `uid` only (`getOrdersForCustomer`), never
 * another customer's orders.
 */
export default async function AccountOrdersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "AccountOrders" });

  const claims = await getSessionClaims();
  // Layout and page render in parallel (Next.js 15), so the page cannot
  // rely on `AccountLayout`'s redirect having already run: guard here too.
  if (!claims) redirect(`/${locale}/login?next=/${locale}/account`);
  const { orders, nextCursorId } = await getOrdersForCustomer(claims.uid);
  const summaries = orders.map(toOrderSummary);

  return (
    <main className="container-luxury py-10">
      <h1 className="mb-6 text-center font-display text-3xl text-text-primary">{t("title")}</h1>

      <div className="mx-auto max-w-2xl">
        {summaries.length === 0 ? (
          <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />
        ) : (
          <OrderHistoryList locale={locale} initialOrders={summaries} initialCursorId={nextCursorId} />
        )}
      </div>
    </main>
  );
}
