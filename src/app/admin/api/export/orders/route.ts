import { requireAdminForRoute } from "@/lib/utils/adminApiGuard";
import { createStreamingXlsxResponse } from "@/lib/utils/xlsx";
import { iterateOrderExportRows, type OrderExportFilters } from "@/lib/domain/admin/export.service";
import { ORDER_STATUSES, type OrderStatus } from "@/types/order";

// ExcelJS's streaming writer needs Node APIs (`node:stream`) — never runs on the Edge runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseStatus(value: string | null): OrderStatus | undefined {
  if (!value) return undefined;
  return (ORDER_STATUSES as readonly string[]).includes(value) ? (value as OrderStatus) : undefined;
}

/**
 * `GET /admin/api/export/orders` (T295, spec FR-102). Streams the Orders
 * report via ExcelJS's `WorkbookWriter` over a single Firestore query with
 * every filter applied server-side (query filters, never a post-fetch
 * in-memory filter, research.md §46).
 */
export async function GET(request: Request): Promise<Response> {
  const guardResponse = await requireAdminForRoute();
  if (guardResponse) return guardResponse;

  const { searchParams } = new URL(request.url);
  const filters: OrderExportFilters = {
    from: parseDate(searchParams.get("from")),
    to: parseDate(searchParams.get("to")),
    status: parseStatus(searchParams.get("status")),
    regionId: searchParams.get("regionId") ?? undefined,
  };

  return createStreamingXlsxResponse("tia-orders.xlsx", async (workbook) => {
    const worksheet = workbook.addWorksheet("Orders");
    worksheet.columns = [
      { header: "Order Number", key: "orderNumber", width: 20 },
      { header: "Date", key: "date", width: 22 },
      { header: "Customer Name", key: "customerName", width: 22 },
      { header: "Phone", key: "phone", width: 16 },
      { header: "Email", key: "email", width: 26 },
      { header: "Region", key: "region", width: 16 },
      { header: "City / Area", key: "city", width: 16 },
      { header: "Address", key: "address", width: 30 },
      { header: "Products", key: "products", width: 50 },
      { header: "Total", key: "total", width: 12 },
      { header: "Payment Method", key: "paymentMethod", width: 18 },
      { header: "Status", key: "status", width: 14 },
      { header: "Customer Type", key: "customerType", width: 14 },
    ];

    for await (const row of iterateOrderExportRows(filters)) {
      worksheet.addRow(row).commit();
    }
    worksheet.commit();
  });
}
