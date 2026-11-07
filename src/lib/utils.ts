import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const SCHOOL_TZ = "Asia/Jakarta";
const WALL = new Intl.DateTimeFormat("en-CA", {
  timeZone: SCHOOL_TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
});

/**
 * Mengubah SATU SAAT (timestamp) menjadi Date yang bagian jam dindingnya sama dengan jam di Jakarta,
 * apa pun zona waktu runtime. Server Vercel berjalan di UTC; tanpa ini jam tampil mundur 7 jam.
 * Tanggal tanpa jam (yyyy-MM-dd) tidak diubah.
 */
function toSchoolClock(value: string | Date): Date {
  const isInstant = value instanceof Date || /T\d{2}:\d{2}/.test(value);
  const date = typeof value === "string" ? parseISO(value) : value;
  if (!isInstant) return date;
  const p = Object.fromEntries(WALL.formatToParts(date).map((x) => [x.type, x.value]));
  return new Date(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
}

/** Format tanggal Indonesia, contoh: "Senin, 2 November 2026". Timestamp ditampilkan menurut waktu Jakarta. */
export function formatTanggal(value: string | Date, pattern = "EEEE, d MMMM yyyy") {
  return format(toSchoolClock(value), pattern, { locale: idLocale });
}

/** Jam menurut waktu Jakarta (WIB), contoh: "06:45". */
export function formatWaktu(value: string | Date) {
  return format(toSchoolClock(value), "HH:mm", { locale: idLocale });
}

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