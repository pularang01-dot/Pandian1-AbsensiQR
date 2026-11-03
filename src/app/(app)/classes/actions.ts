"use server";

import { revalidatePath } from "next/cache";
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
