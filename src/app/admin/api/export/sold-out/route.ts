import { requireAdminForRoute } from "@/lib/utils/adminApiGuard";
import { createXlsxResponse } from "@/lib/utils/xlsx";
import { getSoldOutExportRows } from "@/lib/domain/admin/export.service";
import { PRODUCT_EXPORT_COLUMNS } from "@/lib/domain/admin/export-columns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** `GET /admin/api/export/sold-out` (T298, spec FR-106) — exactly the products where the shared `isSoldOut` derivation (T083) is true. */
export async function GET(): Promise<Response> {
  const guardResponse = await requireAdminForRoute();
  if (guardResponse) return guardResponse;

  const rows = await getSoldOutExportRows();

  return createXlsxResponse("elora-sold-out.xlsx", (workbook) => {
    const worksheet = workbook.addWorksheet("Sold Out");
    worksheet.columns = PRODUCT_EXPORT_COLUMNS;
    worksheet.addRows(rows);
  });
}
