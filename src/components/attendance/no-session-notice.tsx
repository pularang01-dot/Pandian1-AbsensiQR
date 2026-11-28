import { CalendarOff } from "lucide-react";
import { noSessionText, type DayInfo } from "@/lib/data/day-info";

/** Pemberitahuan bahwa tanggal ini tidak memiliki sesi absensi (hari libur atau bukan hari sekolah). */
export function NoSessionNotice({ info, className = "mb-4" }: { info: DayInfo; className?: string }) {
  const n = noSessionText(info);
  if (!n) return null;
  return (
    <div role="status" className={`flex items-start gap-3 rounded-xl border border-[#F5B82E]/60 bg-[#F5B82E]/10 p-4 ${className}`}>
      <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F5B82E] text-navy"><CalendarOff className="h-5 w-5" /></span>
      <div className="min-w-0">
        <p className="text-base font-semibold">{n.title}</p>
        <p className="mt-0.5 text-sm text-ink-muted">{n.text}</p>
      </div>
    </div>
  );
}