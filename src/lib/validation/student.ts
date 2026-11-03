import { z } from "zod";

const emptyToNull = (v: string | undefined) => (v && v.length > 0 ? v : null);

export const studentSchema = z.object({
  nis: z.string().trim().min(1, "NIS wajib diisi.").max(30, "NIS maksimal 30 karakter."),
  nisn: z
    .string()
    .trim()
    .optional()
    .transform(emptyToNull)
    .refine((v) => v === null || /^\d{5,20}$/.test(v), "NISN hanya berisi angka (5-20 digit)."),
  full_name: z.string().trim().min(2, "Nama lengkap minimal 2 karakter.").max(150, "Nama lengkap maksimal 150 karakter."),
  gender: z.enum(["L", "P", ""]).optional().transform((v) => (v ? v : null)),
  class_id: z.string().uuid("Kelas tidak valid.").or(z.literal("")).optional().transform(emptyToNull),
  status: z.enum(["active", "transferred", "graduated", "inactive"]),
});
export type StudentInput = z.infer<typeof studentSchema>;

export const STUDENT_STATUS_LABEL: Record<string, string> = {
  active: "Aktif",
  transferred: "Pindah",
  graduated: "Lulus",
  inactive: "Nonaktif",
};

export const importRowSchema = z.object({
  nis: z.string().trim().max(30).default(""),
  nisn: z.string().trim().max(20).default(""),
  full_name: z.string().trim().max(150).default(""),
  gender: z.string().trim().max(1).default(""),
  class_name: z.string().trim().max(50).default(""),
});
export const importSchema = z.object({
  rows: z.array(importRowSchema).min(1, "File tidak berisi data.").max(1000, "Maksimal 1000 baris per impor."),
  year_id: z.string().uuid("Tahun ajaran tidak valid."),
});

export const linkParentSchema = z.object({
  student_id: z.string().uuid(),
  parent_id: z.string().uuid("Pilih orang tua/wali."),
  relationship: z.enum(["ayah", "ibu", "wali"]),
});
