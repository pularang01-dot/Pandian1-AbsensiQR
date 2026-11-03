import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className={cn(btn, "hover:bg-canvas")}><ChevronLeft className="h-4 w-4" aria-hidden />Sebelumnya</Link>
        ) : (
          <span className={cn(btn, "cursor-not-allowed text-ink-muted/50")} aria-disabled><ChevronLeft className="h-4 w-4" aria-hidden />Sebelumnya</span>
        )}
        <span className="tabular px-2 text-sm text-ink-muted">{page} / {pages}</span>
        {page < pages ? (
          <Link href={href(page + 1)} className={cn(btn, "hover:bg-canvas")}>Berikutnya<ChevronRight className="h-4 w-4" aria-hidden /></Link>
        ) : (
          <span className={cn(btn, "cursor-not-allowed text-ink-muted/50")} aria-disabled>Berikutnya<ChevronRight className="h-4 w-4" aria-hidden /></span>
        )}
      </div>
    </nav>
  );
}

export function parsePage(value: string | undefined) {
  const n = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}
