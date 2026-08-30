import "server-only";
import ExcelJS from "exceljs";
import { PassThrough } from "node:stream";
import { Readable } from "node:stream";

/**
 * Shared `.xlsx` HTTP response helpers (T293, research.md §45–§46). Every
 * admin export Route Handler builds its file through one of these two
 * functions rather than hand-rolling response headers — so the
 * `Content-Type`/`Content-Disposition` contract (contracts/route-handlers.md
 * "Admin — Data Export") can never drift between report types.
 */

const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function attachmentHeaders(filename: string): HeadersInit {
  return {
    "Content-Type": XLSX_CONTENT_TYPE,
    "Content-Disposition": `attachment; filename="${filename}"`,
  };
}

/**
 * Small/bounded report types (Products, Inventory, SOLD OUT, Customers,
 * Sales, Best Sellers, Delivery Locations — all naturally capped by the
 * store's actual catalog/customer/location size, research.md §45): builds
 * the whole workbook in memory via the simple `ExcelJS.Workbook` API, then
 * returns it as a single, complete `Response`.
 */
export async function createXlsxResponse(
  filename: string,
  build: (workbook: ExcelJS.Workbook) => void,
): Promise<Response> {
  const workbook = new ExcelJS.Workbook();
  build(workbook);
  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer as ArrayBuffer, { headers: attachmentHeaders(filename) });
}

/**
 * Large/unbounded report types (Orders — the one most likely to grow large
 * as the store's order history accumulates, research.md §45): streams rows
 * to the client as they're written via ExcelJS's streaming
 * `WorkbookWriter`, rather than materializing the entire dataset in memory
 * first. `build` receives the writer and is responsible for adding
 * worksheet(s)/rows and calling `.commit()` on each worksheet — this
 * function calls the writer's own `.commit()` once `build` resolves.
 *
 * If `build` throws, the underlying Node stream is destroyed with that
 * error so the client sees a failed/truncated download rather than a
 * silently-empty or corrupt file — there is no way to change the HTTP
 * status after the streaming `Response` has already started, so a
 * mid-stream failure is a truncated file, an accepted trade-off at this
 * project's launch scale (plan.md "Scale/Scope") in exchange for never
 * buffering an unbounded Orders export in memory.
 */
export function createStreamingXlsxResponse(
  filename: string,
  build: (workbook: InstanceType<typeof ExcelJS.stream.xlsx.WorkbookWriter>) => Promise<void>,
): Response {
  const nodeStream = new PassThrough();
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: nodeStream, useStyles: true });

  build(workbook)
    .then(() => workbook.commit())
    .catch((err: unknown) => {
      nodeStream.destroy(err instanceof Error ? err : new Error(String(err)));
    });

  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;
  return new Response(webStream, { headers: attachmentHeaders(filename) });
}
