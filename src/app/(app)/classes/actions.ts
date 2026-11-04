"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { classSchema } from "@/lib/validation/class";
import { friendlyDbError, zodFieldErrors, type ActionState } from "@/lib/validation/common";

export async function saveClassAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(ADMIN_ROLES);
  const parsed = classSchema.safeParse({
    name: formData.get("name") ?? "",
    academic_year_id: formData.get("academic_year_id") ?? "",
    grade_level: formData.get("grade_level") ?? "",
    homeroom_teacher_id: formData.get("homeroom_teacher_id") ?? "",
    is_active: formData.get("is_active") === "on",
  });
  if (!parsed.success) return { ok: false, fieldErrors: zodFieldErrors(parsed.error) };

  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const { error } = id
    ? await supabase.from("classes").update(parsed.data).eq("id", id)
    : await supabase.from("classes").insert(parsed.data);

  if (error) {
    if (error.code === "23505") return { ok: false, fieldErrors: { name: "Nama kelas sudah dipakai pada tahun ajaran ini." } };
    return { ok: false, message: friendlyDbError(error) };
  }
  revalidatePath("/classes");
  if (id) revalidatePath(`/classes/${id}`);
  return { ok: true, message: id ? "Kelas diperbarui." : "Kelas dibuat." };
}

export async function moveHomeroomAction(fromClassId: string, toClassId: string): Promise<ActionState> {
  await requireRole(ADMIN_ROLES);
  const ok = z.string().uuid().safeParse(fromClassId).success && z.string().uuid().safeParse(toClassId).success;
  if (!ok) return { ok: false, message: "Data tidak valid." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("move_homeroom_teacher", { p_from: fromClassId, p_to: toClassId });
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/classes");
  revalidatePath(`/classes/${fromClassId}`);
  revalidatePath(`/classes/${toClassId}`);
  const swapped = (data as { swapped?: boolean } | null)?.swapped;
  return { ok: true, message: swapped ? "Wali kelas kedua kelas ditukar." : "Wali kelas dipindahkan. Kelas asal kini belum memiliki wali." };
}