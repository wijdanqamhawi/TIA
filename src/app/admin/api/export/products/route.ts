import { requireAdminForRoute } from "@/lib/utils/adminApiGuard";
import { createXlsxResponse } from "@/lib/utils/xlsx";
import { getProductExportRows } from "@/lib/domain/admin/export.service";
import { PRODUCT_EXPORT_COLUMNS } from "@/lib/domain/admin/export-columns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** `GET /admin/api/export/products` (T296, spec FR-103). */
export async function GET(request: Request): Promise<Response> {
  const guardResponse = await requireAdminForRoute();
  if (guardResponse) return guardResponse;

  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get("categoryId") ?? undefined;
  const rows = await getProductExportRows(categoryId);

  return createXlsxResponse("tia-products.xlsx", (workbook) => {
    const worksheet = workbook.addWorksheet("Products");
    worksheet.columns = PRODUCT_EXPORT_COLUMNS;
    worksheet.addRows(rows);
  });
}
