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

export type GraduatePreview = {
  ok: boolean;
  message?: string;
  className?: string;
  students?: number;
  parentsLinked?: number;
  parentsToDeactivate?: number;
  parentsDeactivated?: number;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Pratinjau kelulusan: tidak mengubah apa pun. */
export async function previewGraduateClassAction(classId: string): Promise<GraduatePreview> {
  await requireRole(ADMIN_ROLES);
  if (!UUID_RE.test(classId)) return { ok: false, message: "Data tidak valid." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("graduate_students", { p_class: classId, p_deactivate_parents: true, p_dry: true });
  if (error) return { ok: false, message: friendlyDbError(error) };
  const d = data as { class: string; students: number; parents_linked: number; parents_to_deactivate: number };
  return { ok: true, className: d.class, students: d.students, parentsLinked: d.parents_linked, parentsToDeactivate: d.parents_to_deactivate };
}

export async function graduateClassAction(classId: string, deactivateParents: boolean, confirm: string): Promise<GraduatePreview> {
  await requireRole(ADMIN_ROLES);
  if (confirm !== "LULUS") return { ok: false, message: "Ketik LULUS (huruf besar) untuk melanjutkan." };
  if (!UUID_RE.test(classId)) return { ok: false, message: "Data tidak valid." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("graduate_students", { p_class: classId, p_deactivate_parents: deactivateParents, p_dry: false });
  if (error) return { ok: false, message: friendlyDbError(error) };
  const d = data as { students: number; parents_deactivated: number };
  revalidatePath("/classes");
  revalidatePath(`/classes/${classId}`);
  revalidatePath("/students");
  revalidatePath("/settings/users");
  return { ok: true, students: d.students, parentsDeactivated: d.parents_deactivated, message: `${d.students} siswa diluluskan.${d.parents_deactivated ? ` ${d.parents_deactivated} akun orang tua dinonaktifkan.` : ""}` };
}