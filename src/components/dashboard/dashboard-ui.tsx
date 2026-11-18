import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type HeroAction = { href: string; label: string; icon: LucideIcon };

/** Cincin persentase kehadiran. Angka tetap tertulis di tengah, jadi tidak bergantung pada warna. */
function RateRing({ rate }: { rate: number | null }) {
  const size = 148;
  const stroke = 13;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = rate === null ? 0 : Math.max(0, Math.min(100, rate));
  const offset = circ * (1 - pct / 100);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={rate === null ? "Persentase kehadiran belum tersedia" : `Persentase kehadiran ${pct.toFixed(1)} persen`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F5B82E" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset} className="ring-progress"
          style={{ ["--ring-circ" as string]: circ, ["--ring-offset" as string]: offset }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular text-[2rem] font-bold leading-none tracking-tight text-white">
          {rate === null ? "-" : pct.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          {rate !== null && <span className="text-lg font-semibold text-white/70">%</span>}
        </span>
        <span className="mt-1 text-xs text-white/70">hadir</span>
      </div>
    </div>
  );
}

function HeroNumber({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0">
      <p className="tabular text-2xl font-semibold leading-none text-white">{value.toLocaleString("id-ID")}</p>
      <p className="mt-1.5 text-xs text-white/70">{label}</p>
    </div>
  );
}

export function DashboardHero({
  greeting, name, dateLabel, yearName, isToday, rate, present, late, unrecorded, actions,
}: {
  greeting: string; name: string; dateLabel: string; yearName?: string; isToday: boolean;
  rate: number | null; present: number; late: number; unrecorded: number; actions: HeroAction[];
}) {
  return (
    <section aria-label="Ringkasan hari ini" className="dash-hero relative mb-6 overflow-hidden rounded-2xl bg-navy text-white shadow-pop">
      <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-10">
        <div className="min-w-0">
          <p className="text-sm text-white/70">{greeting}</p>
          <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight sm:text-3xl">{name}</h1>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-white/15 px-3 py-1 font-medium">{dateLabel}</span>
            {yearName && <span className="rounded-full bg-white/15 px-3 py-1">Tahun ajaran {yearName}</span>}
            {!isToday && <span className="rounded-full bg-[#F5B82E] px-3 py-1 font-semibold text-navy">Bukan hari ini</span>}
          </div>
          <div className="mt-6 grid max-w-sm grid-cols-3 gap-4 border-t border-white/15 pt-5">
            <HeroNumber label="Hadir" value={present} />
            <HeroNumber label="Terlambat" value={late} />
            <HeroNumber label="Belum tercatat" value={unrecorded} />
          </div>
          {actions.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {actions.map((a, i) => (
                <Link
                  key={a.href}
                  href={a.href}
                  className={cn(
                    "inline-flex h-11 items-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors",
                    i === 0 ? "bg-white text-navy hover:bg-white/90" : "bg-white/10 text-white hover:bg-white/20",
                  )}
                >
                  <a.icon className="h-4 w-4" aria-hidden />{a.label}
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-4 lg:flex-col lg:gap-3">
          <RateRing rate={rate} />
          <p className="max-w-[10rem] text-xs leading-relaxed text-white/70 lg:text-center">Kehadiran fisik dari seluruh siswa aktif pada tanggal terpilih.</p>
        </div>
      </div>
    </section>
  );
}

const ACCENT = {
  brand: { bar: "bg-brand", icon: "bg-brand-light text-brand" },
  success: { bar: "bg-success", icon: "bg-success/10 text-success" },
  warning: { bar: "bg-warning", icon: "bg-warning/10 text-[#9a6510]" },
  danger: { bar: "bg-danger", icon: "bg-danger/10 text-danger" },
  info: { bar: "bg-info", icon: "bg-info/10 text-info" },
  neutral: { bar: "bg-ink-muted", icon: "bg-canvas text-ink-muted" },
} as const;
export type Accent = keyof typeof ACCENT;

/** Angka utama: penanda warna di sisi kiri, label dan angka selalu tertulis. */
export function KpiTile({ label, value, icon: Icon, tone, helper }: { label: string; value: number | string; icon: LucideIcon; tone: Accent; helper?: string }) {
  return (
    <div className="card relative overflow-hidden p-5 pl-6">
      <span className={cn("absolute inset-y-0 left-0 w-1.5", ACCENT[tone].bar)} aria-hidden />
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-ink-muted">{label}</p>
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", ACCENT[tone].icon)}><Icon className="h-[18px] w-[18px]" aria-hidden /></span>
      </div>
      <p className="tabular mt-2 text-2xl font-bold sm:text-3xl tracking-tight text-ink">{typeof value === "number" ? value.toLocaleString("id-ID") : value}</p>
      {helper && <p className="mt-1 text-xs text-ink-muted">{helper}</p>}
    </div>
  );
}

/** Angka pendamping: lebih ringkas daripada KpiTile. */
export function MiniStat({ label, value, icon: Icon, tone, helper }: { label: string; value: number; icon: LucideIcon; tone: Accent; helper?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-card">
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", ACCENT[tone].icon)}><Icon className="h-[18px] w-[18px]" aria-hidden /></span>
      <div className="min-w-0">
        <p className="text-xs leading-tight text-ink-muted">{label}</p>
        <p className="tabular text-lg font-semibold leading-tight text-ink">{value.toLocaleString("id-ID")}</p>
        {helper && <p className="text-[11px] leading-tight text-ink-muted">{helper}</p>}
      </div>
    </div>
  );
}

/** Judul panel: ikon kecil, judul, dan tautan opsional. */
export function PanelHeader({ icon: Icon, title, href, linkLabel = "Lihat semua", right }: { icon: LucideIcon; title: string; href?: string; linkLabel?: string; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
      <h2 className="flex items-center gap-2.5 text-base font-semibold">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-light text-brand"><Icon className="h-4 w-4" aria-hidden /></span>
        {title}
      </h2>
      {right ?? (href && <Link href={href} className="text-sm font-medium text-brand hover:underline">{linkLabel}</Link>)}
    </div>
  );
}

/** Inisial nama dalam lingkaran, memudahkan memindai daftar. */
export function Initials({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const text = ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
  return <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-light text-xs font-semibold text-brand">{text}</span>;
}

export function ChartPanel({ title, subtitle, children, className }: { title: string; subtitle?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("card p-5", className)}>
      <h2 className="text-base font-semibold">{title}</h2>
      {subtitle && <p className="mb-3 mt-0.5 text-sm text-ink-muted">{subtitle}</p>}
      {children}
    </div>
  );
}