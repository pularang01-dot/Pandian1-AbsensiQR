"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resetPasswordSchema, type ActionState } from "@/lib/validation/auth";

export async function resetPasswordAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse({ password: fd.get("password") ?? "", confirm: fd.get("confirm") ?? "" });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) { const k = String(i.path[0] ?? "form"); if (!(k in fieldErrors)) fieldErrors[k] = i.message; }
    return { ok: false, fieldErrors };
  }
  const supabase = await createClient();
  // Hanya pengguna dengan sesi sah (dari tautan email) yang dapat mengganti kata sandi.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Tautan tidak valid atau sudah kedaluwarsa. Minta tautan baru." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, message: "Kata sandi belum dapat diperbarui. Coba kata sandi lain yang lebih kuat." };
  redirect("/dashboard");
}
