import Link from "next/link";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { ordersCollection } from "@/lib/firebase/firestore";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/admin/DataTable";
import { ORDER_STATUSES, type OrderStatus } from "@/types/order";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<OrderStatus, "neutral" | "gold" | "burgundy" | "danger"> = {
  PENDING: "gold",
  CONFIRMED: "burgundy",
  PREPARING: "burgundy",
  SHIPPED: "burgundy",
  DELIVERED: "neutral",
  CANCELLED: "danger",
};

const ORDERS_LIST_LIMIT = 100;

/** Admin — Orders (T164): every order, newest first, with a customer/order-number search and a status filter. */
export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status } = await searchParams;
  getAdminFirestore();
  const snapshot = await ordersCollection().orderBy("createdAt", "desc").limit(ORDERS_LIST_LIMIT).get();
  let orders = snapshot.docs.map((doc) => doc.data());

  const query = q?.trim().toLowerCase() ?? "";
  if (query) {
    orders = orders.filter(
      (order) =>
        order.orderNumber.toLowerCase().includes(query) || order.customerSnapshot.fullName.toLowerCase().includes(query),
    );
  }
  const statusFilter = status && ORDER_STATUSES.includes(status as OrderStatus) ? (status as OrderStatus) : null;
  if (statusFilter) {
    orders = orders.filter((order) => order.status === statusFilter);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl">Orders</h1>
        <p className="mt-1 text-sm text-text-primary/70">Every order placed, guest and registered.</p>
      </div>
      <form method="get" className="flex flex-wrap gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by order # or customer…"
          className="min-h-11 w-full max-w-sm rounded-md border border-border-luxury bg-brand-ivory px-3 py-2 text-text-primary"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          className="min-h-11 rounded-md border border-border-luxury bg-brand-ivory px-3 py-2 text-text-primary"
        >
          <option value="">All statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button type="submit" className="min-h-11 rounded-md border border-border-luxury px-4 text-sm hover:bg-brand-beige">
          Filter
        </button>
      </form>
      <DataTable
        rows={orders}
        rowKey={(row) => row.id}
        emptyMessage="No orders match this search."
        columns={[
          {
            header: "Order #",
            render: (row) => (
              <Link href={`/admin/orders/${row.id}`} className="font-medium text-brand-burgundy hover:underline">
                {row.orderNumber}
              </Link>
            ),
          },
          { header: "Customer", render: (row) => row.customerSnapshot.fullName },
          { header: "Date", render: (row) => row.createdAt.toDate().toLocaleDateString("en-US") },
          { header: "Total", render: (row) => (row.total / 100).toFixed(2) },
          { header: "Status", render: (row) => <Badge variant={STATUS_BADGE[row.status]}>{row.status}</Badge> },
        ]}
      />
    </div>
  );
}
