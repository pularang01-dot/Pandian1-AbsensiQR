import Link from "next/link";
import { Download, FileText, Info } from "lucide-react";
import { PrintButton } from "@/components/ui/print-button";
import { ErrorState } from "@/components/ui/states";
import type { ReportTable } from "@/lib/data/reports";
import { Letterhead } from "@/components/brand/letterhead";

/** Tabel laporan yang ramah cetak. Angka rata kanan agar mudah dibandingkan. */
export async function ReportView({ table, exportQuery, detailBase }: { table: ReportTable; exportQuery: string; detailBase?: string }) {
  const isNumeric = (v: string | number) => typeof v === "number" || /^[\d.,]+%?$|^-$/.test(String(v));
  const lastIsTotal = String(table.rows.at(-1)?.[0]) === "Total";
  // Kolom angka: rata kanan, juga pada judulnya. Ditentukan dari baris pertama.
  const numericCol = (ci: number) => ci > 1 && table.rows.length > 0 && isNumeric(table.rows[0][ci]);
  const percentOf = (v: string | number) => {
    const m = /^(\d+(?:[.,]\d+)?)%$/.exec(String(v).trim());
    return m ? Math.max(0, Math.min(100, Number(m[1].replace(",", ".")))) : null;
  };

  return (
    <div className="card print:border-0 print:shadow-none">
      <div className="hidden p-4 pb-0 print:block"><Letterhead /></div>
      <div className="flex flex-col gap-4 border-b border-line p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-light text-brand print:hidden"><FileText className="h-5 w-5" aria-hidden /></span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold leading-tight">{table.title}</h2>
            <p className="mt-0.5 text-sm text-ink-muted">{table.subtitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {(["xlsx", "csv", "pdf"] as const).map((f) => (
            <a key={f} href={`/reports/export?${exportQuery}&format=${f}`} className="inline-flex h-11 items-center gap-2 rounded-lg border border-line bg-surface px-3.5 text-sm font-medium transition-colors hover:border-brand/40 hover:bg-brand-light/50">
              <Download className="h-4 w-4 text-brand" aria-hidden />{f.toUpperCase()}
            </a>
          ))}
          <PrintButton />
        </div>
      </div>
      {table.error ? <ErrorState message={table.error} /> : table.rows.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-base font-medium">Tidak ada data untuk filter ini</p>
          <p className="mt-1 text-sm text-ink-muted">Ubah tanggal, kelas, atau periode lalu terapkan lagi.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">{table.title}. {table.subtitle}</caption>
            <thead>
              <tr className="border-b border-line bg-canvas text-left text-xs text-ink-muted">
                {table.head.map((h, i) => <th key={h} scope="col" className={`px-4 py-3 font-semibold ${numericCol(i) ? "text-right" : ""}`}>{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {table.rows.map((r, ri) => {
                const isTotal = lastIsTotal && ri === table.rows.length - 1;
                return (
                  <tr key={ri} className={isTotal ? "bg-brand-light/60 font-semibold" : "transition-colors hover:bg-canvas/70"}>
                    {r.map((c, ci) => {
                      const pct = numericCol(ci) ? percentOf(c) : null;
                      return (
                        <td key={ci} className={`px-4 py-3 ${numericCol(ci) ? "tabular text-right" : ""}`}>
                          {detailBase && ci === 1 && table.rowIds?.[ri] ? <Link href={`${detailBase}${table.rowIds[ri]}`} className="font-medium hover:text-brand">{c}</Link> : c}
                          {pct !== null && (
                            <span aria-hidden className="ml-auto mt-1 block h-1 w-16 overflow-hidden rounded-full bg-line print:hidden">
                              <span className="block h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {table.notes.length > 0 && (
        <ul className="m-4 space-y-1.5 rounded-xl bg-canvas p-4 text-xs leading-relaxed text-ink-muted">
          {table.notes.map((n) => (
            <li key={n} className="flex gap-2"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand print:hidden" aria-hidden /><span>{n}</span></li>
          ))}
        </ul>
      )}
    </div>
  );
}