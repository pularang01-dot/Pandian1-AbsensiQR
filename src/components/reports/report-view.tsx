import Link from "next/link";
import { Download } from "lucide-react";
import { PrintButton } from "@/components/ui/print-button";
import { ErrorState } from "@/components/ui/states";
import type { ReportTable } from "@/lib/data/reports";

/** Tabel laporan yang ramah cetak. Angka rata kanan agar mudah dibandingkan. */
export function ReportView({ table, exportQuery, detailBase }: { table: ReportTable; exportQuery: string; detailBase?: string }) {
  const isNumeric = (v: string | number) => typeof v === "number" || /^[\d.,]+%?$|^-$/.test(String(v));
  const lastIsTotal = String(table.rows.at(-1)?.[0]) === "Total";

  return (
    <div className="card print:border-0 print:shadow-none">
      <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">{table.title}</h2>
          <p className="text-sm text-ink-muted">{table.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          {(["xlsx", "csv", "pdf"] as const).map((f) => (
            <a key={f} href={`/reports/export?${exportQuery}&format=${f}`} className="inline-flex h-11 items-center gap-2 rounded-lg border border-line px-3.5 text-sm font-medium hover:bg-canvas">
              <Download className="h-4 w-4" aria-hidden />{f.toUpperCase()}
            </a>
          ))}
          <PrintButton />
        </div>
      </div>
      {table.error ? <ErrorState message={table.error} /> : table.rows.length === 0 ? (
        <p className="p-6 text-sm text-ink-muted">Tidak ada data untuk filter ini.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">{table.title}. {table.subtitle}</caption>
            <thead>
              <tr className="border-b border-line bg-canvas text-left text-xs text-ink-muted">
                {table.head.map((h, i) => <th key={h} scope="col" className={`px-3 py-2.5 font-medium ${i > 1 || (i === 1 && !detailBase) ? "" : ""}`}>{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {table.rows.map((r, ri) => (
                <tr key={ri} className={lastIsTotal && ri === table.rows.length - 1 ? "bg-canvas font-semibold" : ""}>
                  {r.map((c, ci) => (
                    <td key={ci} className={`px-3 py-2.5 ${isNumeric(c) && ci > 1 ? "tabular text-right" : ""}`}>
                      {detailBase && ci === 1 && table.rowIds?.[ri] ? <Link href={`${detailBase}${table.rowIds[ri]}`} className="font-medium hover:text-brand">{c}</Link> : c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ul className="space-y-1 border-t border-line p-4 text-xs text-ink-muted">
        {table.notes.map((n) => <li key={n}>{n}</li>)}
      </ul>
    </div>
  );
}
