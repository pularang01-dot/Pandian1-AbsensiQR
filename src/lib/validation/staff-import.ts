import { z } from "zod";
import type { Role } from "@/lib/auth/roles";

export const MAX_STAFF_ROWS = 50;

export const STAFF_ROLE_ALIASES: Record<string, Role> = {
  guru: "teacher", "wali kelas": "teacher", teacher: "teacher",
  operator: "operator",
  "kepala sekolah": "principal", penyetuju: "principal", principal: "principal",
  admin: "school_admin", "admin sekolah": "school_admin", "administrator sekolah": "school_admin", school_admin: "school_admin",
};

export const staffRowSchema = z.object({
  full_name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(150, "Nama maksimal 150 karakter."),
  email: z.string().trim().toLowerCase().email("Format email tidak valid."),
  phone: z.string().trim().max(30, "Telepon maksimal 30 karakter.").optional().default(""),
  role: z.string().trim().min(1, "Peran wajib diisi.").transform((v, ctx) => {
    const r = STAFF_ROLE_ALIASES[v.toLowerCase()];
    if (!r) ctx.addIssue({ code: "custom", message: "Peran tidak dikenal. Gunakan: Guru, Operator, Kepala Sekolah, atau Admin." });
    return r as Role;
  }),
  class_name: z.string().trim().max(50).optional().default(""),
});

export const staffRowsSchema = z.array(z.unknown()).min(1, "Tidak ada baris data.").max(MAX_STAFF_ROWS, `Maksimal ${MAX_STAFF_ROWS} baris per impor.`);

export type StaffImportResult = {
  ok: boolean;
  message?: string;
  created?: number;
  results?: { line: number; email: string; status: "dibuat" | "dilewati" | "gagal"; message: string }[];
};