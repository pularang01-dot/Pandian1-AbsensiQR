import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Email wajib diisi.").email("Format email tidak valid."),
  password: z.string().min(1, "Kata sandi wajib diisi."),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().min(1, "Email wajib diisi.").email("Format email tidak valid."),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(10, "Kata sandi minimal 10 karakter."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Konfirmasi kata sandi tidak sama." });

export type ActionState = { ok: boolean; message?: string; fieldErrors?: Record<string, string> };
