import Link from "next/link";
import { getAllCustomers } from "@/lib/domain/admin/customer.service";
import { DataTable } from "@/components/admin/DataTable";

export const dynamic = "force-dynamic";

/** Admin — Customers (T167): every registered customer. */
export default async function AdminCustomersPage() {
  const customers = await getAllCustomers();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl">Customers</h1>
        <p className="mt-1 text-sm text-text-primary/70">Registered customers only — guest checkouts have no account.</p>
      </div>
      <DataTable
        rows={customers}
        rowKey={(row) => row.uid}
        emptyMessage="No registered customers yet."
        columns={[
          {
            header: "Name",
            render: (row) => (
              <Link href={`/admin/customers/${row.uid}`} className="font-medium text-brand-burgundy hover:underline">
                {row.name}
              </Link>
            ),
          },
          { header: "Email", render: (row) => row.email },
          { header: "Phone", render: (row) => row.phone ?? "—" },
          { header: "Joined", render: (row) => row.createdAt.toDate().toLocaleDateString("en-US") },
        ]}
      />
    </div>
  );
}
