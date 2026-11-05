"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError, zodFieldErrors, type ActionState } from "@/lib/validation/common";
import { importSchema, linkParentSchema, studentSchema } from "@/lib/validation/student";

function fieldFromDuplicate(message: string | undefined): Record<string, string> | null {
  if (!message) return null;
  if (message.includes("students_nis_key")) return { nis: "NIS sudah terdaftar." };
  if (message.includes("students_nisn_key")) return { nisn: "NISN sudah terdaftar." };
  return null;
}

export async function saveStudentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(ADMIN_ROLES);

  const parsed = studentSchema.safeParse({
    nis: formData.get("nis") ?? "",
    nisn: formData.get("nisn") ?? "",
    full_name: formData.get("full_name") ?? "",
    gender: formData.get("gender") ?? "",
    class_id: formData.get("class_id") ?? "",
    status: formData.get("status") ?? "active",
  });
  if (!parsed.success) return { ok: false, fieldErrors: zodFieldErrors(parsed.error) };

  const supabase = await createClient();
  const { class_id, ...fields } = parsed.data;
  const editingId = String(formData.get("id") ?? "");
  let studentId = editingId;

  if (editingId) {
    const { error } = await supabase.from("students").update(fields).eq("id", editingId);
    if (error) {
      const dup = fieldFromDuplicate(error.message);
      return dup ? { ok: false, fieldErrors: dup } : { ok: false, message: friendlyDbError(error) };
    }
  } else {
    const { data, error } = await supabase.from("students").insert(fields).select("id").single();
    if (error || !data) {
      const dup = fieldFromDuplicate(error?.message);
      return dup ? { ok: false, fieldErrors: dup } : { ok: false, message: friendlyDbError(error) };
    }
    studentId = data.id;
    // QR awal diterbitkan otomatis; berisi token acak, bukan data siswa.
    const qr = await supabase.rpc("regenerate_qr_token", { p_student_id: studentId });
    if (qr.error) {
      return { ok: false, message: `Siswa tersimpan, tetapi QR belum dapat diterbitkan: ${friendlyDbError(qr.error)}` };
    }
  }

  if (class_id && fields.status === "active") {
    const { error } = await supabase.rpc("assign_student_class", { p_student: studentId, p_class: class_id });
    if (error) return { ok: false, message: `Data tersimpan, tetapi penempatan kelas gagal: ${friendlyDbError(error)}` };
  }

  revalidatePath("/students");
  redirect(`/students/${studentId}`);
}

export async function setStudentStatusAction(studentId: string, status: string): Promise<ActionState> {
  await requireRole(ADMIN_ROLES);
  if (!["active", "transferred", "graduated", "inactive"].includes(status)) return { ok: false, message: "Status tidak valid." };
  const supabase = await createClient();
  const { error } = await supabase.from("students").update({ status }).eq("id", studentId);
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/students");
  const message = status === "active"
    ? "Siswa diaktifkan kembali. Tempatkan siswa ke kelas dan terbitkan QR baru karena penempatan lama dan QR lama sudah ditutup."
    : "Status siswa diperbarui. Penempatan kelas ditutup, QR dicabut, dan riwayat absensi tetap tersimpan. Akun orang tua terkait kehilangan akses ke siswa ini.";
  return { ok: true, message };
}

export async function regenerateQrAction(studentId: string): Promise<ActionState> {
  await requireRole(ADMIN_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.rpc("regenerate_qr_token", { p_student_id: studentId });
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath(`/students/${studentId}`);
  return { ok: true, message: "QR baru diterbitkan. QR lama sudah tidak berlaku." };
}

export async function assignClassAction(studentId: string, classId: string): Promise<ActionState> {
  await requireRole(ADMIN_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_student_class", { p_student: studentId, p_class: classId });
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/classes");
  return { ok: true, message: "Kelas siswa diperbarui." };
}

export async function linkParentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(ADMIN_ROLES);
  const parsed = linkParentSchema.safeParse({
    student_id: formData.get("student_id"),
    parent_id: formData.get("parent_id"),
    relationship: formData.get("relationship"),
  });
  if (!parsed.success) return { ok: false, fieldErrors: zodFieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("parent_student_links")
    .upsert({ ...parsed.data, is_active: true }, { onConflict: "parent_id,student_id" });
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath(`/students/${parsed.data.student_id}`);
  return { ok: true, message: "Orang tua/wali berhasil dihubungkan." };
}

export async function unlinkParentAction(linkId: string, studentId: string): Promise<ActionState> {
  await requireRole(ADMIN_ROLES);
  const supabase = await createClient();
  // Nonaktifkan, tidak menghapus: riwayat tetap utuh.
  const { error } = await supabase.from("parent_student_links").update({ is_active: false }).eq("id", linkId);
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath(`/students/${studentId}`);
  return { ok: true, message: "Hubungan orang tua/wali dinonaktifkan." };
}

export type ImportResult = ActionState & { inserted?: number; skipped?: { row: number; nis: string | null; reason: string }[] };

export async function importStudentsAction(payload: unknown): Promise<ImportResult> {
  await requireRole(ADMIN_ROLES);
  const parsed = importSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Data impor tidak valid." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_students", { p_rows: parsed.data.rows, p_year: parsed.data.year_id });
  if (error) return { ok: false, message: friendlyDbError(error) };

  revalidatePath("/students");
  const result = data as { inserted: number; skipped: { row: number; nis: string | null; reason: string }[] };
  return { ok: true, inserted: result.inserted, skipped: result.skipped };
}

export type DeleteTarget = { studentId?: string; classId?: string };
export type DeleteStudentsResult = {
  ok: boolean;
  message?: string;
  total?: number;
  deletable?: number;
  deleted?: number;
  skipped?: { id: string; nis: string; name: string; reason: string }[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveDeleteIds(target: DeleteTarget): Promise<{ ids: string[] } | { error: string }> {
  const supabase = await createClient();
  if (target.studentId) {
    if (!UUID.test(target.studentId)) return { error: "Data tidak valid." };
    return { ids: [target.studentId] };
  }
  if (target.classId) {
    if (!UUID.test(target.classId)) return { error: "Data tidak valid." };
    // Daftar siswa diambil di server (bukan dari peramban) dari penempatan kelas yang sedang berjalan.
    const { data, error } = await supabase.from("student_class_assignments").select("student_id").eq("class_id", target.classId).is("end_date", null).limit(501);
    if (error) return { error: friendlyDbError(error) };
    const ids = [...new Set((data ?? []).map((r) => r.student_id as string))];
    if (ids.length === 0) return { error: "Kelas ini tidak memiliki siswa." };
    if (ids.length > 500) return { error: "Maksimal 500 siswa per penghapusan." };
    return { ids };
  }
  return { error: "Pilih siswa atau kelas." };
}

/** Pratinjau: tidak menghapus apa pun. Menunjukkan berapa siswa yang dapat dihapus dan mana yang dilindungi. */
export async function previewDeleteStudentsAction(target: DeleteTarget): Promise<DeleteStudentsResult> {
  await requireRole(ADMIN_ROLES);
  const r = await resolveDeleteIds(target);
  if ("error" in r) return { ok: false, message: r.error };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_students", { p_ids: r.ids, p_confirm: "", p_dry: true });
  if (error) return { ok: false, message: friendlyDbError(error) };
  const d = data as { deletable: number; skipped: DeleteStudentsResult["skipped"] };
  return { ok: true, total: r.ids.length, deletable: d.deletable, skipped: d.skipped ?? [] };
}

export async function deleteStudentsAction(target: DeleteTarget, confirm: string): Promise<DeleteStudentsResult> {
  await requireRole(ADMIN_ROLES);
  if (confirm !== "HAPUS") return { ok: false, message: "Ketik HAPUS (huruf besar) untuk melanjutkan." };
  const r = await resolveDeleteIds(target);
  if ("error" in r) return { ok: false, message: r.error };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_students", { p_ids: r.ids, p_confirm: confirm, p_dry: false });
  if (error) return { ok: false, message: friendlyDbError(error) };
  const d = data as { deleted: number; skipped: DeleteStudentsResult["skipped"] };
  revalidatePath("/students");
  revalidatePath("/classes");
  if (target.classId) revalidatePath(`/classes/${target.classId}`);
  return { ok: true, deleted: d.deleted, skipped: d.skipped ?? [], message: `${d.deleted} siswa dihapus permanen.` };
}