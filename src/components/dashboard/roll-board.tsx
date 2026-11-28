import Link from "next/link";
import { CalendarClock, CalendarOff, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type MarkKey = "present" | "late" | "sick" | "permission" | "official_activity" | "unexcused" | "unverified" | "unrecorded";

export const MARK_ORDER: MarkKey[] = ["present", "late", "sick", "permission", "official_activity", "unexcused", "unverified", "unrecorded"];

const MARK_LABEL: Record<MarkKey, string> = {
  present: "Hadir", late: "Terlambat", sick: "Sakit", permission: "Izin", official_activity: "Kegiatan resmi",
  unexcused: "Alpa", unverified: "Belum diverifikasi", unrecorded: "Belum tercatat",
};
const MARK_COLOR: Record<MarkKey, string> = {
  present: "#16865B", late: "#D99124", sick: "#3985C8", permission: "#3478D4", official_activity: "#64748B",
  unexcused: "#D64B4B", unverified: "#8A96A8", unrecorded: "#A8B3C2",
};

/** Setiap status punya bentuk sendiri, jadi papan tetap terbaca tanpa mengandalkan warna. */
export function Mark({ kind, size = 12 }: { kind: MarkKey; size?: number }) {
  const c = MARK_COLOR[kind];
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden className="shrink-0">
      {kind === "present" && <circle cx="6" cy="6" r="5" fill={c} />}
      {kind === "late" && (<><circle cx="6" cy="6" r="4.5" fill="none" stroke={c} strokeWidth="1.5" /><path d="M6 1.5a4.5 4.5 0 0 0 0 9z" fill={c} /></>)}
      {kind === "sick" && <path d="M4.5 1h3v3.5H11v3H7.5V11h-3V7.5H1v-3h3.5z" fill={c} />}
      {kind === "permission" && <rect x="1.5" y="1.5" width="9" height="9" rx="1.5" fill={c} />}
      {kind === "official_activity" && <path d="M6 .8 11.2 6 6 11.2.8 6z" fill={c} />}
      {kind === "unexcused" && <path d="M2 2l8 8M10 2l-8 8" stroke={c} strokeWidth="2.2" strokeLinecap="round" />}
      {kind === "unverified" && <circle cx="6" cy="6" r="4.3" fill="none" stroke={c} strokeWidth="1.5" strokeDasharray="2.2 1.6" />}
      {kind === "unrecorded" && <circle cx="6" cy="6" r="4.3" fill="none" stroke={c} strokeWidth="1.3" />}
    </svg>
  );
}

export type Tally = Record<MarkKey, number>;

/** Keterangan bentuk, lengkap dengan jumlah. Status yang kosong disembunyikan. */
export function MarkLegend({ tally, className, onDark = false }: { tally: Tally; className?: string; onDark?: boolean }) {
  const items = MARK_ORDER.filter((k) => tally[k] > 0);
  if (items.length === 0) return null;
  return (
    <ul className={cn("flex flex-wrap gap-x-5 gap-y-2 text-sm", className)}>
      {items.map((k) => (
        <li key={k} className="flex items-center gap-1.5">
          <Mark kind={k} />
          <span className={onDark ? "text-white/70" : "text-ink-muted"}>{MARK_LABEL[k]}</span>
          <span className={cn("tabular font-semibold", onDark ? "text-white" : "text-ink")}>{tally[k].toLocaleString("id-ID")}</span>
        </li>
      ))}
    </ul>
  );
}

/** Pita tunggal: perbandingan seluruh siswa. Angka ada di keterangan, bukan hanya warna. */
export function TallyBar({ tally, total, onDark = false }: { tally: Tally; total: number; onDark?: boolean }) {
  if (total <= 0) return null;
  return (
    <div className={cn("flex h-3 w-full overflow-hidden rounded-full ring-1", onDark ? "bg-white/10 ring-white/20" : "bg-canvas ring-line")} aria-hidden>
      {MARK_ORDER.filter((k) => tally[k] > 0).map((k) => (
        <span key={k} style={{ width: `${(tally[k] / total) * 100}%`, backgroundColor: k === "unrecorded" ? "transparent" : MARK_COLOR[k] }} className={k === "unrecorded" ? "" : "border-r border-surface/70 last:border-r-0"} />
      ))}
    </div>
  );
}

function Stat({ label, value, unit, hint }: { label: string; value: string; unit?: string; hint?: string }) {
  return (
    <div className="min-w-0 px-4 first:pl-0 last:pr-0 sm:px-6">
      <p className="text-xs font-medium text-white/70">{label}</p>
      <p className="tabular mt-1 text-3xl font-bold leading-none tracking-tight text-white sm:text-4xl">
        {value}{unit && <span className="ml-0.5 text-xl font-semibold text-white/70">{unit}</span>}
      </p>
      {hint && <p className="mt-1.5 truncate text-xs text-white/60">{hint}</p>}
    </div>
  );
}

export function DayHeader({
  weekday, day, monthYear, greeting, name, yearName, isToday, hasSession, seen, unrecorded, rateValue, tally, total, actions, closedDay,
}: {
  weekday: string; day: string; monthYear: string; greeting: string; name: string; yearName?: string; isToday: boolean;
  hasSession: boolean; seen: number; unrecorded: number; rateValue: string | null; tally: Tally; total: number;
  actions: { href: string; label: string; icon: LucideIcon }[];
  closedDay?: { title: string; text: string } | null;
}) {
  const nf = (n: number) => n.toLocaleString("id-ID");
  return (
    <section aria-label="Ringkasan hari ini" className="dash-hero relative mb-6 overflow-hidden rounded-2xl bg-navy text-white shadow-pop">
      <div className="grid md:grid-cols-[12rem_1fr]">
        {/* Lembar kalender */}
        <div className="relative flex items-center gap-5 bg-black/25 px-6 pb-5 pt-7 text-white md:flex-col md:items-start md:justify-between md:gap-0 md:p-7">
          <span aria-hidden className="absolute inset-x-0 top-0 h-1.5 bg-[#F5B82E]" />
          <span aria-hidden className="absolute right-5 top-4 hidden gap-1.5 md:flex"><i className="h-2 w-2 rounded-full bg-white/25" /><i className="h-2 w-2 rounded-full bg-white/25" /></span>
          <p className="text-sm font-medium capitalize tracking-wide text-[#F5B82E] md:order-1">{weekday}</p>
          <p className="tabular text-7xl font-bold leading-none tracking-tighter md:order-2 md:my-4 md:text-8xl">{day}</p>
          <p className="text-sm capitalize text-white/75 md:order-3">{monthYear}</p>
        </div>

        <div className="min-w-0 p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <div className="min-w-0">
              <p className="text-sm text-white/70">{greeting}</p>
              <h1 className="mt-0.5 truncate text-2xl font-semibold tracking-tight sm:text-3xl">{name}</h1>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-medium">
              {yearName && <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">Tahun ajaran {yearName}</span>}
              {!isToday && <span className="rounded-full bg-[#F5B82E] px-3 py-1.5 font-semibold text-navy">Bukan hari ini</span>}
            </div>
          </div>

          {closedDay ? (
            <div role="status" className="mt-6 flex items-start gap-4 rounded-xl border border-dashed border-[#F5B82E]/70 bg-[#F5B82E]/10 p-5">
              <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F5B82E] text-navy"><CalendarOff className="h-5 w-5" /></span>
              <div className="min-w-0">
                <p className="text-base font-semibold">{closedDay.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-white/75">{closedDay.text}</p>
              </div>
            </div>
          ) : hasSession ? (
            <div className="mt-6">
              <div className="flex divide-x divide-white/15">
                <Stat label="Sudah masuk" value={nf(seen)} hint={`dari ${nf(total)} siswa aktif`} />
                <Stat label="Kehadiran fisik" value={rateValue ?? "-"} unit={rateValue ? "%" : undefined} hint="hadir dan terlambat" />
                <Stat label="Belum tercatat" value={nf(unrecorded)} hint={unrecorded > 0 ? "belum dianggap alpa" : "semua sudah tercatat"} />
              </div>
              <div className="mt-6"><TallyBar tally={tally} total={total} onDark /></div>
              <MarkLegend tally={tally} className="mt-3" onDark />
            </div>
          ) : (
            <div role="status" className="mt-6 flex items-start gap-4 rounded-xl border border-dashed border-white/30 bg-white/10 p-5">
              <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-[#F5B82E]"><CalendarClock className="h-5 w-5" /></span>
              <div className="min-w-0">
                <p className="text-base font-semibold">Sesi absensi belum dibuka</p>
                <p className="mt-1 text-sm leading-relaxed text-white/75">
                  Belum ada catatan pada tanggal ini. {nf(total)} siswa aktif menunggu dicatat, dan tidak ada yang otomatis dianggap alpa sebelum rekonsiliasi.
                </p>
              </div>
              <div className="ml-auto shrink-0 self-center border-l border-white/20 pl-4 text-right sm:pl-6">
                <p className="text-xs text-white/70">Kehadiran fisik</p>
                <p className="tabular text-2xl font-bold leading-tight">{rateValue ?? "-"}{rateValue && <span className="text-base font-semibold text-white/70">%</span>}</p>
              </div>
            </div>
          )}

          {actions.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2 border-t border-white/15 pt-5">
              {actions.map((a, i) => (
                <Link
                  key={a.href}
                  href={a.href}
                  className={cn(
                    "inline-flex h-11 items-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors",
                    i === 0 ? "bg-[#F5B82E] font-semibold text-navy hover:bg-[#e8aa1f]" : "bg-white/10 text-white hover:bg-white/20",
                  )}
                >
                  <a.icon className="h-4 w-4" aria-hidden />{a.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export type BoardRow = { id: string | null; name: string; total: number; tally: Tally; rateText: string; href: string };

/** Papan apel: satu tanda mewakili satu siswa, dikelompokkan per kelas. */
export function RollBoard({ rows }: { rows: BoardRow[] }) {
  return (
    <ul className="grid gap-3 lg:grid-cols-2">
      {rows.map((r) => {
        const recorded = r.total - r.tally.unrecorded;
        return (
          <li key={r.id ?? "none"}>
            <Link href={r.href} className="group block rounded-xl border border-line bg-canvas/50 p-4 transition-colors hover:border-brand/50 hover:bg-brand-light/40">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-base font-semibold">{r.name}</h3>
                <p className="tabular text-sm text-ink-muted">
                  <span className="font-semibold text-ink">{recorded}</span> dari {r.total} tercatat | {r.rateText}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5" aria-hidden>
                {MARK_ORDER.flatMap((k) => Array.from({ length: r.tally[k] }, (_, i) => <Mark key={`${k}${i}`} kind={k} size={14} />))}
              </div>
              <p className="sr-only">
                {MARK_ORDER.filter((k) => r.tally[k] > 0).map((k) => `${MARK_LABEL[k]} ${r.tally[k]}`).join(", ")}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}