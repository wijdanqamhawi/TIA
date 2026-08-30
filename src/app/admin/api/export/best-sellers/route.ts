import { requireAdminForRoute } from "@/lib/utils/adminApiGuard";
import { createXlsxResponse } from "@/lib/utils/xlsx";
import { getBestSellerExportRows } from "@/lib/domain/admin/export.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** `GET /admin/api/export/best-sellers` (T301, spec FR-105) — ranked by cumulative quantity sold, excluding cancelled orders, matching the dashboard's own ranking. */
export async function GET(request: Request): Promise<Response> {
  const guardResponse = await requireAdminForRoute();
  if (guardResponse) return guardResponse;

  const { searchParams } = new URL(request.url);
  const rows = await getBestSellerExportRows({
    from: parseDate(searchParams.get("from")),
    to: parseDate(searchParams.get("to")),
  });

  return createXlsxResponse("elora-best-sellers.xlsx", (workbook) => {
    const worksheet = workbook.addWorksheet("Best Sellers");
    worksheet.columns = [
      { header: "Product ID", key: "productId", width: 24 },
      { header: "Product Name", key: "nameEn", width: 28 },
      { header: "Quantity Sold", key: "quantitySold", width: 16 },
    ];
    worksheet.addRows(rows);
  });
}
