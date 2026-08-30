import { requireAdminForRoute } from "@/lib/utils/adminApiGuard";
import { createXlsxResponse } from "@/lib/utils/xlsx";
import { getSalesExportRows } from "@/lib/domain/admin/export.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** `GET /admin/api/export/sales` (T300, spec FR-105) — figures computed identically to the dashboard's own statistics (T169), excluding cancelled orders. */
export async function GET(request: Request): Promise<Response> {
  const guardResponse = await requireAdminForRoute();
  if (guardResponse) return guardResponse;

  const { searchParams } = new URL(request.url);
  const rows = await getSalesExportRows({
    from: parseDate(searchParams.get("from")),
    to: parseDate(searchParams.get("to")),
  });

  return createXlsxResponse("elora-sales.xlsx", (workbook) => {
    const worksheet = workbook.addWorksheet("Sales");
    worksheet.columns = [
      { header: "Metric", key: "metric", width: 22 },
      { header: "Value", key: "value", width: 18 },
    ];
    worksheet.addRows(rows);
  });
}
