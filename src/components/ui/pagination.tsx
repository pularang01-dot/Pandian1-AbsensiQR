import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const PAGE_SIZE = 20;

/** Paginasi berbasis URL (?page=). Mempertahankan parameter pencarian/filter lain. */
export function Pagination({
  page,
  total,
  pageSize = PAGE_SIZE,
  basePath,
  params = {},
}: {
  page: number;
  total: number;
  pageSize?: number;
  basePath: string;
  params?: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;

  const hrefTo = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    if (p > 1) q.set("page", String(p));
    const qs = q.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  // Nomor halaman melebihi jumlah halaman (misalnya setelah data berkurang): arahkan ke halaman terakhir.
  if (page > pages) redirect(hrefTo(pages));

  // Jendela nomor halaman: 1 ... (p-1) p (p+1) ... N
  const nums = Array.from(new Set([1, page - 1, page, page + 1, pages].filter((n) => n >= 1 && n <= pages))).sort((a, b) => a - b);
  const items: (number | "gap")[] = [];
  nums.forEach((n, i) => { if (i > 0 && n - nums[i - 1] > 1) items.push("gap"); items.push(n); });

  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const btn = "inline-flex h-10 items-center gap-1 rounded-lg border border-line bg-surface px-3 text-sm font-medium";

  return (
    <nav aria-label="Paginasi" className="flex flex-col items-center justify-between gap-3 border-t border-line px-4 py-3 sm:flex-row">
      <p className="tabular text-sm text-ink-muted">Menampilkan {from}-{to} dari {total}</p>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {page > 1 ? (
          <Link href={href(1)} aria-label="Halaman pertama" className={cn(btn, "px-2.5 hover:bg-canvas")}><ChevronsLeft className="h-4 w-4" aria-hidden /></Link>
        ) : (
          <span className={cn(btn, "cursor-not-allowed px-2.5 text-ink-muted/50")} aria-disabled><ChevronsLeft className="h-4 w-4" aria-hidden /><span className="sr-only">Halaman pertama</span></span>
        )}
        {page > 1 ? (
          <Link href={href(page - 1)} className={cn(btn, "hover:bg-canvas")}><ChevronLeft className="h-4 w-4" aria-hidden /><span className="hidden sm:inline">Sebelumnya</span><span className="sr-only sm:hidden">Sebelumnya</span></Link>
        ) : (
          <span className={cn(btn, "cursor-not-allowed text-ink-muted/50")} aria-disabled><ChevronLeft className="h-4 w-4" aria-hidden /><span className="hidden sm:inline">Sebelumnya</span><span className="sr-only sm:hidden">Sebelumnya</span></span>
        )}
        {items.map((it, i) =>
          it === "gap" ? (
            <span key={`g${i}`} className="px-1 text-ink-muted" aria-hidden>...</span>
          ) : it === page ? (
            <span key={it} aria-current="page" className="tabular inline-flex h-10 min-w-10 items-center justify-center rounded-lg bg-brand px-2 text-sm font-semibold text-white">{it}</span>
          ) : (
            <Link key={it} href={href(it)} aria-label={`Halaman ${it}`} className={cn(btn, "tabular min-w-10 justify-center px-2 hover:bg-canvas")}>{it}</Link>
          ),
        )}
        {page < pages ? (
          <Link href={href(page + 1)} className={cn(btn, "hover:bg-canvas")}><span className="hidden sm:inline">Berikutnya</span><span className="sr-only sm:hidden">Berikutnya</span><ChevronRight className="h-4 w-4" aria-hidden /></Link>
        ) : (
          <span className={cn(btn, "cursor-not-allowed text-ink-muted/50")} aria-disabled><span className="hidden sm:inline">Berikutnya</span><span className="sr-only sm:hidden">Berikutnya</span><ChevronRight className="h-4 w-4" aria-hidden /></span>
        )}
        {page < pages ? (
          <Link href={href(pages)} aria-label="Halaman terakhir" className={cn(btn, "px-2.5 hover:bg-canvas")}><ChevronsRight className="h-4 w-4" aria-hidden /></Link>
        ) : (
          <span className={cn(btn, "cursor-not-allowed px-2.5 text-ink-muted/50")} aria-disabled><ChevronsRight className="h-4 w-4" aria-hidden /><span className="sr-only">Halaman terakhir</span></span>
        )}
        {pages > 1 && (
          <form action={basePath} method="get" className="ml-1 flex items-center gap-1.5">
            {Object.entries(params).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
            <label htmlFor="goto-page" className="text-sm text-ink-muted">Ke halaman</label>
            <input id="goto-page" name="page" type="number" inputMode="numeric" min={1} max={pages} defaultValue={page} className="tabular h-10 w-16 rounded-lg border border-line bg-surface px-2 text-center text-sm" />
            <button type="submit" className={cn(btn, "hover:bg-canvas")}>Buka</button>
          </form>
        )}
      </div>
    </nav>
  );
}

export function parsePage(value: string | undefined) {
  const n = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}