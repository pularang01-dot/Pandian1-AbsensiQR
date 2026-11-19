import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Panel atas untuk halaman alur persetujuan (izin, dispensasi, pulang lebih awal). */
export function WorkflowHero({
  icon: Icon, title, description, total, totalLabel, action,
}: { icon: LucideIcon; title: string; description: string; total: number; totalLabel: string; action?: ReactNode }) {
  return (
    <section className="dash-hero mb-6 overflow-hidden rounded-2xl p-6 text-white shadow-pop sm:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15"><Icon className="h-7 w-7" aria-hidden /></span>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-white/75">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <p>
            <span className="tabular block text-4xl font-bold leading-none">{total.toLocaleString("id-ID")}</span>
            <span className="mt-1.5 block text-xs text-white/70">{totalLabel}</span>
          </p>
          {action}
        </div>
      </div>
    </section>
  );
}

/** Tombol utama di dalam panel biru. */
export function HeroAction({ href, icon: Icon, children }: { href: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#F5B82E] px-4 text-sm font-semibold text-navy transition-colors hover:bg-[#f7c653]">
      <Icon className="h-4 w-4" aria-hidden />{children}
    </Link>
  );
}

export type StatusTab = { key: string; label: string; count: number; attention?: boolean };

/** Deretan penyaring status dengan jumlah. "Semua" memakai kunci kosong. */
export function StatusTabs({ basePath, tabs, active, q }: { basePath: string; tabs: StatusTab[]; active: string; q?: string }) {
  const href = (k: string) => {
    const p = new URLSearchParams({ status: k || "all" });
    if (q) p.set("q", q);
    return `${basePath}?${p.toString()}`;
  };
  return (
    <nav aria-label="Saring menurut status" className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
      {tabs.map((t) => {
        const on = active === t.key;
        return (
          <Link
            key={t.key || "all"}
            href={href(t.key)}
            aria-current={on ? "true" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              on ? "border-navy bg-navy text-white shadow-card" : "border-line bg-surface text-ink hover:border-brand/40 hover:bg-brand-light/50",
            )}
          >
            {t.label}
            <span className={cn("tabular rounded-full px-2 py-0.5 text-xs font-semibold", on ? "bg-white/20 text-white" : t.attention && t.count > 0 ? "bg-warning/20 text-[#8a5a0e]" : "bg-canvas text-ink-muted")}>{t.count}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function Avatar({ name }: { name: string }) {
  const text = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-light text-xs font-semibold text-brand">{text || "?"}</span>;
}