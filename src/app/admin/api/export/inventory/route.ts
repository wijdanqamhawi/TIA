import { requireAdminForRoute } from "@/lib/utils/adminApiGuard";
import { createXlsxResponse } from "@/lib/utils/xlsx";
import { getInventoryExportRows } from "@/lib/domain/admin/export.service";
import { PRODUCT_EXPORT_COLUMNS } from "@/lib/domain/admin/export-columns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** `GET /admin/api/export/inventory` (T297, spec FR-108). */
export async function GET(request: Request): Promise<Response> {
  const guardResponse = await requireAdminForRoute();
  if (guardResponse) return guardResponse;

  const { searchParams } = new URL(request.url);
  const rawThreshold = searchParams.get("lowStockThreshold");
  const lowStockThreshold = rawThreshold !== null && !Number.isNaN(Number(rawThreshold)) ? Number(rawThreshold) : undefined;
  const rows = await getInventoryExportRows(lowStockThreshold);

  return createXlsxResponse("elora-inventory.xlsx", (workbook) => {
    const worksheet = workbook.addWorksheet("Inventory");
    worksheet.columns = PRODUCT_EXPORT_COLUMNS;
    worksheet.addRows(rows);
  });
}
