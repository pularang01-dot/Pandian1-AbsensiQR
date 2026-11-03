import { z } from "zod";

export const classSchema = z.object({
  name: z.string().trim().min(1, "Nama kelas wajib diisi.").max(50, "Nama kelas maksimal 50 karakter."),
  academic_year_id: z.string().uuid("Pilih tahun ajaran."),
  grade_level: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? Number(v) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 1 && v <= 6), "Tingkat kelas harus 1 sampai 6."),
  homeroom_teacher_id: z.string().uuid().or(z.literal("")).optional().transform((v) => (v ? v : null)),
  is_active: z.boolean(),
});
