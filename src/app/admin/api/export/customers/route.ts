import { requireAdminForRoute } from "@/lib/utils/adminApiGuard";
import { createXlsxResponse } from "@/lib/utils/xlsx";
import { getCustomerExportRows } from "@/lib/domain/admin/export.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** `GET /admin/api/export/customers` (T299, spec FR-104) — profile + order-history summary only, never a password/credential/token value. */
export async function GET(): Promise<Response> {
  const guardResponse = await requireAdminForRoute();
  if (guardResponse) return guardResponse;

  const rows = await getCustomerExportRows();

  return createXlsxResponse("tia-customers.xlsx", (workbook) => {
    const worksheet = workbook.addWorksheet("Customers");
    worksheet.columns = [
      { header: "UID", key: "uid", width: 24 },
      { header: "Name", key: "name", width: 22 },
      { header: "Email", key: "email", width: 26 },
      { header: "Phone", key: "phone", width: 16 },
      { header: "Region", key: "region", width: 16 },
      { header: "City / Area", key: "city", width: 16 },
      { header: "Order Count", key: "orderCount", width: 12 },
      { header: "Total Spent", key: "totalSpent", width: 14 },
      { header: "Joined Date", key: "joinedDate", width: 22 },
    ];
    worksheet.addRows(rows);
  });
}
