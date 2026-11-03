import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { EmptyState } from "./states";

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  /** Sembunyikan kolom pada layar kecil (data tetap tersedia di halaman rincian). */
  hideOnMobile?: boolean;
};

/** Tabel responsif: dapat digulir mendatar pada layar sempit. Komponen server (tanpa state). */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyTitle = "Belum ada data",
  emptyDescription,
  emptyAction,
  caption,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  caption?: string;
}) {
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-full text-left text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-line bg-canvas/60">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn("whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted", c.hideOnMobile && "hidden md:table-cell", c.className)}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => (
            <tr key={rowKey(row)} className="hover:bg-canvas/50">
              {columns.map((c) => (
                <td key={c.key} className={cn("px-4 py-3 align-middle text-ink", c.hideOnMobile && "hidden md:table-cell", c.className)}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
