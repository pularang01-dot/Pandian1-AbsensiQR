import { z } from "zod";

export const recordAttendanceSchema = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("qr"),
    student_id: z.string().uuid(),
    token: z.string().trim().min(32).max(128),
  }),
  z.object({
    source: z.literal("manual"),
    student_id: z.string().uuid(),
    status: z.enum(["present", "late", "sick", "permission", "unexcused", "unverified"]),
    note: z.string().trim().min(3, "Catatan alasan wajib diisi (minimal 3 karakter).").max(500),
  }),
]);

export const correctionSchema = z.object({
  record_id: z.string().uuid(),
  new_status: z.enum(["present", "late", "sick", "permission", "official_activity", "unexcused", "unverified"]),
  reason: z.string().trim().min(5, "Alasan koreksi minimal 5 karakter.").max(500),
});

export const classAttendanceSchema = z.object({
  class_id: z.string().uuid(),
  entries: z.array(z.object({
    student_id: z.string().uuid(),
    status: z.enum(["present", "late", "sick", "permission", "unexcused"]),
    note: z.string().trim().max(300, "Catatan maksimal 300 karakter.").optional(),
  })).min(1, "Belum ada siswa yang dipilih.").max(200, "Terlalu banyak baris dalam satu simpanan."),
});

export type RpcResult = {
  result: string;
  message?: string;
  status?: string;
  full_name?: string;
  nis?: string;
  class_name?: string | null;
  student_id?: string;
  existing_status?: string | null;
  existing_at?: string | null;
  recorded_at?: string;
};

/** Pesan Indonesia untuk setiap kode hasil dari fungsi database. */
export const RESULT_MESSAGE: Record<string, string> = {
  ok: "QR valid.",
  recorded: "Kehadiran tercatat.",
  invalid: "Kode QR tidak dikenal. Gunakan pencarian manual.",
  revoked: "Kode QR ini sudah dinonaktifkan. Minta kartu QR baru kepada administrator.",
  duplicate: "Siswa sudah tercatat hari ini.",
  student_inactive: "Siswa tidak aktif atau tidak ditemukan.",
  forbidden: "Anda tidak berwenang mencatat siswa ini.",
  not_school_day: "Hari ini bukan hari sekolah menurut kalender.",
  session_closed: "Sesi absensi hari ini sudah ditutup.",
  note_required: "Catatan alasan wajib diisi untuk absensi manual.",
  not_allowed: "Status ini tidak dapat dicatat oleh peran Anda.",
  invalid_source: "Sumber absensi tidak valid.",
};