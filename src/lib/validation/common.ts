import type { z } from "zod";

export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
};

export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

/** Menerjemahkan galat PostgREST/Postgres ke pesan Indonesia tanpa membocorkan detail internal. */
export function friendlyDbError(error: { code?: string; message?: string } | null | undefined): string {
  if (!error) return "Terjadi kesalahan tak dikenal.";
  const msg = error.message ?? "";
  // Pesan dari fungsi database kita (RAISE EXCEPTION) sudah berbahasa Indonesia dan aman ditampilkan.
  if (error.code === "P0001") return msg;
  if (error.code === "42501" || /row-level security|permission denied/i.test(msg)) return "Anda tidak berwenang melakukan tindakan ini.";
  if (error.code === "23505") return "Data yang sama sudah ada.";
  if (error.code === "23503") return "Data terkait tidak ditemukan.";
  if (error.code === "23514") return "Data tidak memenuhi aturan yang berlaku. Periksa kembali isian Anda.";
  if (/fetch failed|network|ECONN|timeout/i.test(msg)) return "Tidak dapat terhubung ke server. Data belum tersimpan. Periksa koneksi internet lalu coba lagi.";
  return "Data belum tersimpan karena terjadi kesalahan. Silakan coba lagi.";
}

/** Menghindari karakter yang bermakna khusus pada filter PostgREST (.or) dan LIKE. */
export function sanitizeSearch(q: string | undefined | null): string {
  return (q ?? "").replace(/[%,()*\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}
