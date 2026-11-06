import { z } from "zod";
import { ROLES } from "@/lib/auth/roles";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Format jam HH:MM.");

export const schoolSchema = z.object({
  name: z.string().trim().min(3, "Nama sekolah minimal 3 karakter.").max(150),
  address: z.string().trim().max(300, "Alamat maksimal 300 karakter.").optional(),
  phone: z.string().trim().max(30, "Telepon maksimal 30 karakter.").optional(),
});

export const attendanceSettingsSchema = z
  .object({
    start_time: time, late_after: time, close_time: time,
    school_days: z.array(z.coerce.number().int().min(1).max(7)).min(1, "Pilih minimal satu hari sekolah."),
    doc_days: z.coerce.number().int().min(1, "Minimal 1 hari.").max(30, "Maksimal 30 hari."),
  })
  .refine((v) => v.start_time < v.late_after, { path: ["late_after"], message: "Batas terlambat harus setelah jam masuk." })
  .refine((v) => v.late_after < v.close_time, { path: ["close_time"], message: "Jam penutupan harus setelah batas terlambat." });

export const DAY_LABEL: Record<number, string> = { 1: "Senin", 2: "Selasa", 3: "Rabu", 4: "Kamis", 5: "Jumat", 6: "Sabtu", 7: "Minggu" };

export const yearSchema = z
  .object({
    name: z.string().trim().regex(/^\d{4}\/\d{4}$/, "Format tahun ajaran, contoh 2026/2027."),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal mulai tidak valid."),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal selesai tidak valid."),
  })
  .refine((v) => v.end_date > v.start_date, { path: ["end_date"], message: "Tanggal selesai harus setelah tanggal mulai." });

export const CALENDAR_KIND_LABEL: Record<string, string> = { holiday: "Hari libur", extra_school_day: "Hari sekolah tambahan", special_activity: "Kegiatan khusus" };

export const calendarSchema = z.object({
  calendar_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid."),
  kind: z.enum(["holiday", "extra_school_day", "special_activity"], { errorMap: () => ({ message: "Pilih jenis." }) }),
  description: z.string().trim().min(1, "Keterangan wajib diisi.").max(200, "Maksimal 200 karakter."),
});

export const createUserSchema = z.object({
  full_name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(150),
  email: z.string().trim().toLowerCase().email("Format email tidak valid."),
  phone: z.string().trim().max(30).optional(),
  role: z.enum(ROLES, { errorMap: () => ({ message: "Pilih peran." }) }),
  student_ids: z.array(z.string().uuid()).max(20).default([]),
  relationship: z.enum(["ayah", "ibu", "wali"]).optional(),
  mode: z.enum(["invite", "google"]).default("invite"),
});

export const hygieneSchema = z.object({
  orphan_days: z.coerce.number({ message: "Isi angka." }).int("Harus bilangan bulat.").min(0, "Minimal 0.").max(365, "Maksimal 365."),
  stale_days: z.coerce.number({ message: "Isi angka." }).int("Harus bilangan bulat.").min(0, "Minimal 0.").max(365, "Maksimal 365."),
});