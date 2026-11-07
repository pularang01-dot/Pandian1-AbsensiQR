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

const SCHOOL_TZ = "Asia/Jakarta";
const ISO_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: SCHOOL_TZ, year: "numeric", month: "2-digit", day: "2-digit" });

/**
 * Tanggal menurut zona waktu SEKOLAH (Asia/Jakarta) dalam format yyyy-MM-dd, bukan zona server/perangkat.
 * Server Vercel berjalan di UTC; tanpa ini, antara 00.00 dan 07.00 WIB "hari ini" terbaca sebagai kemarin.
 */
export function todayISO(now: Date = new Date()) {
  return ISO_DAY.format(now);
}

export function percent(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}