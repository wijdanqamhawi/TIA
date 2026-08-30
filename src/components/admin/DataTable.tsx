import type { ReactNode } from "react";

export type DataTableColumn<T> = {
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
};

/**
 * A minimal, reusable admin list table (T171) — every `/admin/*` listing
 * page (products, categories, showcases, orders, customers) renders through
 * this so column layout/responsiveness stays consistent across all of them.
 *
 * Below `md` this renders as a stacked card list (one card per row, each
 * column shown as a label/value pair) instead of a fixed-column table —
 * horizontal scrolling a wide table is never the default mobile
 * presentation (research.md §18a, spec FR-050e). At `md` and above the
 * real table renders, with any remaining horizontal scroll confined to its
 * own `overflow-x-auto` wrapper, never the page.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyMessage = "Nothing to show yet.",
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return <p className="rounded-lg border border-border-luxury bg-brand-ivory p-6 text-sm text-text-primary/70">{emptyMessage}</p>;
  }

  return (
    <>
      <div className="flex flex-col gap-3 md:hidden">
        {rows.map((row) => (
          <div key={rowKey(row)} className="rounded-lg border border-border-luxury bg-brand-ivory p-4">
            {columns.map((column, index) =>
              column.header ? (
                <div key={`${column.header}-${index}`} className="flex items-start justify-between gap-3 py-1 text-sm first:pt-0 last:pb-0">
                  <span className="shrink-0 font-medium text-text-primary/70">{column.header}</span>
                  <span className="text-end">{column.render(row)}</span>
                </div>
              ) : (
                <div key={`action-${index}`} className="flex justify-end pt-2">
                  {column.render(row)}
                </div>
              ),
            )}
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border border-border-luxury md:block">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border-luxury bg-brand-beige text-start">
              {columns.map((column, index) => (
                <th key={`${column.header}-${index}`} className={column.className ?? "p-3 text-start font-medium"}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className="border-b border-border-luxury last:border-0">
                {columns.map((column, index) => (
                  <td key={`${column.header}-${index}`} className="p-3 align-middle">
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
