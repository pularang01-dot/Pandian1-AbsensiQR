/**
 * Mencegah formula injection pada Excel/CSV: sel teks yang diawali = + - @ atau tab/CR
 * diberi awalan apostrof agar tidak dieksekusi sebagai rumus saat dibuka.
 */
export function safeCell<T>(value: T): T | string {
  if (typeof value !== "string") return value;
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    const s = String(safeCell(v ?? ""));
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // BOM agar Excel membaca UTF-8 dengan benar.
  return "﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
}
