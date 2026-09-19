import { requireAdminForRoute } from "@/lib/utils/adminApiGuard";
import { createXlsxResponse } from "@/lib/utils/xlsx";
import { getDeliveryLocationExportRows } from "@/lib/domain/admin/export.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** `GET /admin/api/export/delivery-locations` (T302, spec FR-107) — every region/city with bilingual name, active state, display order. */
export async function GET(): Promise<Response> {
  const guardResponse = await requireAdminForRoute();
  if (guardResponse) return guardResponse;

  const rows = await getDeliveryLocationExportRows();

  return createXlsxResponse("tia-delivery-locations.xlsx", (workbook) => {
    const worksheet = workbook.addWorksheet("Delivery Locations");
    worksheet.columns = [
      { header: "Region", key: "region", width: 20 },
      { header: "City / Area", key: "city", width: 24 },
      { header: "Active", key: "active", width: 10 },
      { header: "Display Order", key: "displayOrder", width: 14 },
    ];
    worksheet.addRows(rows);
  });
}
