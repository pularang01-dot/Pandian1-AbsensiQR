import { CheckCircle2, Clock, HelpCircle, XCircle, Stethoscope, FileText, Flag, AlertTriangle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const TONE: Record<Tone, string> = {
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/10 text-[#9a6510] border-warning/30",
  danger: "bg-danger/10 text-danger border-danger/20",
  info: "bg-info/10 text-info border-info/20",
  neutral: "bg-canvas text-ink-muted border-line",
};

export const ATTENDANCE_STATUS = {
  present: { label: "Hadir", tone: "success", icon: CheckCircle2 },
  late: { label: "Terlambat", tone: "warning", icon: Clock },
  sick: { label: "Sakit", tone: "info", icon: Stethoscope },
  permission: { label: "Izin", tone: "info", icon: FileText },
  official_activity: { label: "Kegiatan Resmi Sekolah", tone: "neutral", icon: Flag },
  unexcused: { label: "Alpa", tone: "danger", icon: XCircle },
  unverified: { label: "Belum Diverifikasi", tone: "neutral", icon: HelpCircle },
} as const satisfies Record<string, { label: string; tone: Tone; icon: LucideIcon }>;

export const REQUEST_STATUS = {
  pending: { label: "Menunggu", tone: "warning", icon: Clock },
  under_review: { label: "Sedang Ditinjau", tone: "info", icon: HelpCircle },
  needs_clarification: { label: "Perlu Klarifikasi", tone: "warning", icon: AlertTriangle },
  approved: { label: "Disetujui", tone: "success", icon: CheckCircle2 },
  rejected: { label: "Ditolak", tone: "danger", icon: XCircle },
  cancelled: { label: "Dibatalkan", tone: "neutral", icon: XCircle },
} as const satisfies Record<string, { label: string; tone: Tone; icon: LucideIcon }>;

export const DISPENSATION_STATUS = {
  pending: { label: "Menunggu", tone: "warning", icon: Clock },
  approved: { label: "Disetujui", tone: "success", icon: CheckCircle2 },
  rejected: { label: "Ditolak", tone: "danger", icon: XCircle },
  cancelled: { label: "Dibatalkan", tone: "neutral", icon: XCircle },
  completed: { label: "Selesai", tone: "info", icon: CheckCircle2 },
} as const satisfies Record<string, { label: string; tone: Tone; icon: LucideIcon }>;

export const DISMISSAL_STATUS = {
  pending: { label: "Menunggu", tone: "warning", icon: Clock },
  approved: { label: "Disetujui, belum diserahkan", tone: "info", icon: HelpCircle },
  rejected: { label: "Ditolak", tone: "danger", icon: XCircle },
  cancelled: { label: "Dibatalkan", tone: "neutral", icon: XCircle },
  completed: { label: "Sudah diserahkan", tone: "success", icon: CheckCircle2 },
} as const satisfies Record<string, { label: string; tone: Tone; icon: LucideIcon }>;

export type AttendanceStatus = keyof typeof ATTENDANCE_STATUS;
export type RequestStatus = keyof typeof REQUEST_STATUS;

/** Status selalu ditampilkan dengan ikon DAN teks, tidak mengandalkan warna saja. */
export function StatusBadge({ status, kind = "attendance" }: { status: string; kind?: "attendance" | "request" | "dispensation" | "dismissal" }) {
  const map = (kind === "attendance" ? ATTENDANCE_STATUS : kind === "dispensation" ? DISPENSATION_STATUS : kind === "dismissal" ? DISMISSAL_STATUS : REQUEST_STATUS) as Record<
    string,
    { label: string; tone: Tone; icon: LucideIcon }
  >;
  const entry = map[status] ?? { label: status, tone: "neutral" as Tone, icon: HelpCircle };
  const Icon = entry.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium",
        TONE[entry.tone],
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {entry.label}
    </span>
  );
}
