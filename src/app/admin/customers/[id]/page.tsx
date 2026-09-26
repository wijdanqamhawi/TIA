import { notFound } from "next/navigation";
import Link from "next/link";
import { getCustomerById, getOrdersForCustomerAdmin } from "@/lib/domain/admin/customer.service";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/admin/DataTable";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/utils/currency";

export const dynamic = "force-dynamic";

/** Admin — Customer Detail (T168): profile plus this customer's full order history. */
export default async function AdminCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await getCustomerById(id);
  if (!customer) {
    notFound();
  }
  const orders = await getOrdersForCustomerAdmin(id);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl">{customer.name}</h1>
        <p className="mt-1 text-sm text-text-primary/70">{customer.email}</p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-display text-lg">Profile</h2>
        </CardHeader>
        <CardBody className="flex flex-col gap-1 text-sm">
          <p>Phone: {customer.phone ?? "—"}</p>
          {customer.profile.address ? (
            <p>
              Address: {customer.profile.address.addressLine} ({customer.profile.address.regionId} /{" "}
              {customer.profile.address.locationId})
            </p>
          ) : (
            <p>No saved address.</p>
          )}
          <p className="text-text-primary/70">Joined {customer.createdAt.toDate().toLocaleDateString("en-US")}</p>
        </CardBody>
      </Card>

      <div>
        <h2 className="mb-2 font-display text-lg">Orders</h2>
        <DataTable
          rows={orders}
          rowKey={(row) => row.id}
          emptyMessage="This customer has not placed any orders yet."
          columns={[
            {
              header: "Order #",
              render: (row) => (
                <Link href={`/admin/orders/${row.id}`} className="font-medium text-brand-burgundy hover:underline">
                  {row.orderNumber}
                </Link>
              ),
            },
            { header: "Date", render: (row) => row.createdAt.toDate().toLocaleDateString("en-US") },
            { header: "Total", render: (row) => formatCurrency(row.total, "en-US") },
            { header: "Status", render: (row) => <Badge>{row.status}</Badge> },
          ]}
        />
      </div>
    </div>
  );
}
