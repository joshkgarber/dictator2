import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type TableColumn<T> = {
  id: string;
  header: string;
  className?: string;
  cell: (row: T) => ReactNode;
};

type DataTableProps<T> = {
  title: string;
  subtitle?: string;
  columns: TableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  actions?: ReactNode;
  emptyMessage?: string;
};

export function DataTable<T>({
  title,
  subtitle,
  columns,
  rows,
  getRowKey,
  actions,
  emptyMessage = "No records to display.",
}: DataTableProps<T>) {
  return (
    <section className="flex flex-col h-full overflow-hidden rounded-xl border border-slate-300 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 flex-shrink-0">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-600">{title}</h3>
          {subtitle && <p className="mt-1 text-sm text-slate-700">{subtitle}</p>}
        </div>
        {actions}
      </header>

      <div className="flex-1 overflow-auto">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-10">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.id}
                  className={cn(
                    "border-b border-slate-300 bg-slate-100 px-4 py-2 text-left font-semibold uppercase tracking-[0.07em] text-slate-600",
                    column.className,
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            )}

            {rows.map((row, index) => (
              <tr key={getRowKey(row)} className={cn(index % 2 === 0 ? "bg-white" : "bg-slate-50/80") }>
                {columns.map((column) => (
                  <td key={column.id} className={cn("border-b border-slate-200 px-4 py-2 align-top text-slate-800", column.className)}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
