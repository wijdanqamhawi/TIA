import Link from "next/link";
import { getDashboardStats, getRecentOrders } from "@/lib/domain/admin/dashboard.service";
import { StatCard } from "@/components/admin/StatCard";
import { DataTable } from "@/components/admin/DataTable";
import { Badge } from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

/** Admin — Dashboard (T170): store-wide statistics, recent orders, and best sellers. */
export default async function AdminDashboardPage() {
  const [{ stats, bestSellers }, recentOrders] = await Promise.all([getDashboardStats(), getRecentOrders()]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total Sales (excl. cancelled)" value={(stats.totalSales / 100).toFixed(2)} />
        <StatCard label="Total Orders (excl. cancelled)" value={stats.totalOrders} />
        <StatCard label="Pending Orders" value={stats.pendingOrders} />
        <StatCard label="Total Products" value={stats.totalProducts} />
        <StatCard label="Total Customers" value={stats.totalCustomers} />
        <StatCard label="Sold Out Products" value={stats.soldOutProducts} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 font-display text-lg">Recent Orders</h2>
          <DataTable
            rows={recentOrders}
            rowKey={(row) => row.id}
            emptyMessage="No orders yet."
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
              { header: "Total", render: (row) => (row.total / 100).toFixed(2) },
              { header: "Status", render: (row) => <Badge>{row.status}</Badge> },
            ]}
          />
        </div>

        <div>
          <h2 className="mb-2 font-display text-lg">Best Sellers (excl. cancelled)</h2>
          <DataTable
            rows={bestSellers}
            rowKey={(row) => row.productId}
            emptyMessage="No sales yet."
            columns={[
              { header: "Product", render: (row) => row.nameEn },
              { header: "Units Sold", render: (row) => row.quantitySold },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
