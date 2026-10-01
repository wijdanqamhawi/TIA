import { getAdminFirestore } from "@/lib/firebase/admin";
import { ordersCollection } from "@/lib/firebase/firestore";
import { getAdminTranslator } from "@/lib/i18n/admin";
import { filterAdminOrders, parseOrderStatus } from "@/lib/domain/admin/order-filters";
import { getOrderSummaryCounts } from "@/lib/domain/admin/order-summary.service";
import {
  AdminOrdersList,
  type AdminOrderRow,
  type OrdersTranslate,
} from "@/components/admin/AdminOrdersList";

export const dynamic = "force-dynamic";

const ORDERS_LIST_LIMIT = 100;

/**
 * Admin — Orders (T164): the newest orders first, with a customer/order-number
 * search and a status filter. The summary figures count every order (Firestore
 * aggregation); the list itself is the newest `ORDERS_LIST_LIMIT`, filtered on
 * the server, exactly as before.
 */
export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status } = await searchParams;
  getAdminFirestore();
  const [snapshot, counts, { t }] = await Promise.all([
    ordersCollection().orderBy("createdAt", "desc").limit(ORDERS_LIST_LIMIT).get(),
    getOrderSummaryCounts(),
    getAdminTranslator("AdminOrders"),
  ]);
  const translate = t as unknown as OrdersTranslate;

  const loaded = snapshot.docs.map((doc) => doc.data());
  const query = q?.trim() ?? "";
  const statusFilter = parseOrderStatus(status);
  const rows: AdminOrderRow[] = filterAdminOrders(loaded, { query, status: statusFilter }).map(
    (order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerSnapshot.fullName,
      customerEmail: order.customerSnapshot.email,
      isGuest: order.userId === null,
      createdAt: order.createdAt.toMillis(),
      total: order.total,
      status: order.status,
    }),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="min-w-0 pt-1">
        <h1 className="font-display text-[32px] font-normal leading-[1.1] text-brand-burgundy lg:text-[38px] rtl:text-[28px] rtl:leading-[1.4] rtl:lg:text-[32px]">
          {translate("title")}
        </h1>
        <p className="mt-1.5 font-display text-[15px] leading-snug text-text-secondary lg:text-[16px] rtl:font-body rtl:text-[14.5px]">
          {translate("subtitle")}
        </p>
      </div>

      <AdminOrdersList
        counts={counts}
        orders={rows}
        fetchedCount={loaded.length}
        totalCount={counts.total}
        query={query}
        status={statusFilter}
      />
    </div>
  );
}
