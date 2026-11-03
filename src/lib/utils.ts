import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format tanggal Indonesia, contoh: "Senin, 2 November 2026". */
export function formatTanggal(value: string | Date, pattern = "EEEE, d MMMM yyyy") {
  const date = typeof value === "string" ? parseISO(value) : value;
  return format(date, pattern, { locale: idLocale });
}

export function formatWaktu(value: string | Date) {
  const date = typeof value === "string" ? parseISO(value) : value;
  return format(date, "HH:mm", { locale: idLocale });
}

/** Tanggal lokal (zona waktu perangkat) dalam format yyyy-MM-dd. */
export function todayISO(now: Date = new Date()) {
  return format(now, "yyyy-MM-dd");
}

export function percent(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}
