import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TONES = {
  brand: "bg-brand-light text-brand",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-[#9a6510]",
  danger: "bg-danger/10 text-danger",
  info: "bg-info/10 text-info",
  neutral: "bg-canvas text-ink-muted",
} as const;

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "brand",
  helper,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone?: keyof typeof TONES;
  helper?: string;
}) {
  return (
    <div className="card flex items-start gap-4 p-5">
      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-lg", TONES[tone])}>
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-ink-muted">{label}</p>
        <p className="tabular mt-0.5 text-2xl font-semibold tracking-tight text-ink">{value}</p>
        {helper && <p className="mt-0.5 text-xs text-ink-muted">{helper}</p>}
      </div>
    </div>
  );
}
