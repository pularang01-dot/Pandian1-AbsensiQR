"use server";

import { revalidatePath } from "next/cache";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError, zodFieldErrors, type ActionState } from "@/lib/validation/common";
import { attendanceSettingsSchema, calendarSchema, hygieneSchema, schoolSchema, yearSchema } from "@/lib/validation/settings";

async function saveSettings(entries: Record<string, unknown>): Promise<ActionState> {
  const user = await requireRole(ADMIN_ROLES);
  const supabase = await createClient();
  // Perubahan tercatat otomatis di audit_logs oleh trigger pada system_settings.
  const { error } = await supabase.from("system_settings").upsert(
    Object.entries(entries).map(([key, value]) => ({ key, value, updated_by: user.id })), { onConflict: "key" },
  );
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/settings", "layout");
  return { ok: true, message: "Pengaturan tersimpan." };
}

export async function saveSchoolAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole(ADMIN_ROLES);
  const parsed = schoolSchema.safeParse({ name: fd.get("name") ?? "", address: fd.get("address") ?? "", phone: fd.get("phone") ?? "" });
  if (!parsed.success) return { ok: false, fieldErrors: zodFieldErrors(parsed.error) };
  const v = parsed.data;
  return saveSettings({ "school.name": v.name, "school.address": v.address ?? "", "school.phone": v.phone ?? "" });
}

export async function saveAttendanceSettingsAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole(ADMIN_ROLES);
  const parsed = attendanceSettingsSchema.safeParse({
    start_time: fd.get("start_time") ?? "", late_after: fd.get("late_after") ?? "", close_time: fd.get("close_time") ?? "",
    school_days: fd.getAll("school_days").map(String), doc_days: fd.get("doc_days") ?? "", go_live_date: String(fd.get("go_live_date") ?? ""),
  });
  if (!parsed.success) return { ok: false, fieldErrors: zodFieldErrors(parsed.error) };
  const v = parsed.data;
  // Berlaku untuk sesi absensi yang dibuat setelah perubahan; sesi yang sudah ada tidak diubah.
  return saveSettings({
    "attendance.start_time": v.start_time, "attendance.late_after": v.late_after, "attendance.close_time": v.close_time,
    "attendance.school_days": [...new Set(v.school_days)].sort(), "permission.document_required_for_sick_days": v.doc_days,
    "attendance.go_live_date": v.go_live_date,
  });
}

export async function createYearAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole(ADMIN_ROLES);
  const parsed = yearSchema.safeParse({ name: fd.get("name") ?? "", start_date: fd.get("start_date") ?? "", end_date: fd.get("end_date") ?? "" });
  if (!parsed.success) return { ok: false, fieldErrors: zodFieldErrors(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.from("academic_years").insert(parsed.data);
  if (error) return { ok: false, message: error.code === "23505" ? "Tahun ajaran dengan nama itu sudah ada." : friendlyDbError(error) };
  revalidatePath("/settings/academic-year");
  return { ok: true, message: "Tahun ajaran dibuat. Aktifkan bila sudah waktunya." };
}

export async function yearTransitionAction(id: string, op: "activate" | "deactivate" | "archive"): Promise<ActionState> {
  await requireRole(ADMIN_ROLES);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, message: "Data tidak valid." };
  const supabase = await createClient();
  const { error } = await supabase.rpc(op === "activate" ? "activate_academic_year" : op === "deactivate" ? "deactivate_academic_year" : "archive_academic_year", { p_id: id });
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/settings/academic-year");
  return { ok: true, message: op === "activate" ? "Tahun ajaran diaktifkan." : op === "deactivate" ? "Tahun ajaran dinonaktifkan. Datanya tetap tersimpan." : "Tahun ajaran diarsipkan. Datanya tetap tersimpan." };
}

export async function addCalendarAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireRole(ADMIN_ROLES);
  const parsed = calendarSchema.safeParse({ calendar_date: fd.get("calendar_date") ?? "", kind: fd.get("kind") ?? "", description: fd.get("description") ?? "" });
  if (!parsed.success) return { ok: false, fieldErrors: zodFieldErrors(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.from("school_calendar").insert({ ...parsed.data, created_by: user.id });
  if (error) return { ok: false, message: error.code === "23505" ? "Tanggal dengan jenis yang sama sudah ada." : friendlyDbError(error) };
  revalidatePath("/settings/school-calendar");
  return { ok: true, message: "Entri kalender ditambahkan." };
}

export async function deleteCalendarAction(id: string): Promise<ActionState> {
  await requireRole(ADMIN_ROLES);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, message: "Data tidak valid." };
  const supabase = await createClient();
  const { error } = await supabase.from("school_calendar").delete().eq("id", id);
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/settings/school-calendar");
  return { ok: true, message: "Entri dihapus. Catatan absensi yang sudah ada tidak berubah." };
}

export async function saveHygieneSettingsAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole(ADMIN_ROLES);
  const parsed = hygieneSchema.safeParse({ orphan_days: fd.get("orphan_days") ?? "", stale_days: fd.get("stale_days") ?? "" });
  if (!parsed.success) return { ok: false, fieldErrors: zodFieldErrors(parsed.error) };
  return saveSettings({ "hygiene.orphan_parent_days": parsed.data.orphan_days, "hygiene.stale_account_days": parsed.data.stale_days });
}

export async function runHygieneNowAction(): Promise<ActionState> {
  await requireRole(ADMIN_ROLES);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("run_account_hygiene_now", { p_dry: false });
  if (error) return { ok: false, message: friendlyDbError(error) };
  const d = data as { orphan_parents?: number; stale_accounts?: number };
  revalidatePath("/settings", "layout");
  const total = Number(d.orphan_parents ?? 0) + Number(d.stale_accounts ?? 0);
  return { ok: true, message: total > 0 ? `${d.orphan_parents ?? 0} akun orang tua dan ${d.stale_accounts ?? 0} akun tidak terpakai dinonaktifkan.` : "Tidak ada akun yang perlu dinonaktifkan." };
}

export type DeleteYearResult = { ok: boolean; deletable?: boolean; name?: string; emptyClasses?: number; reasons?: string[]; message?: string };

/** Pratinjau penghapusan tahun ajaran: tidak mengubah apa pun. */
export async function previewDeleteYearAction(id: string): Promise<DeleteYearResult> {
  await requireRole(ADMIN_ROLES);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, message: "Data tidak valid." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_academic_year", { p_year: id, p_confirm: "", p_dry: true });
  if (error) return { ok: false, message: friendlyDbError(error) };
  const d = (data ?? {}) as { result?: string; name?: string; empty_classes?: number; reasons?: string[]; message?: string };
  if (d.result === "deletable") return { ok: true, deletable: true, name: d.name, emptyClasses: d.empty_classes ?? 0 };
  if (d.result === "protected") return { ok: true, deletable: false, name: d.name, reasons: d.reasons ?? [], message: d.message };
  return { ok: false, message: d.message ?? "Tahun ajaran tidak dapat diperiksa." };
}

export async function deleteYearAction(id: string, confirm: string): Promise<DeleteYearResult> {
  await requireRole(ADMIN_ROLES);
  if (confirm !== "HAPUS") return { ok: false, message: "Ketik HAPUS (huruf besar) untuk melanjutkan." };
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, message: "Data tidak valid." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_academic_year", { p_year: id, p_confirm: confirm, p_dry: false });
  if (error) return { ok: false, message: `${friendlyDbError(error)} Tidak ada data yang dihapus.` };
  const d = (data ?? {}) as { result?: string; name?: string; message?: string };
  if (d.result !== "deleted") return { ok: false, message: `${d.message ?? "Tahun ajaran tidak dapat dihapus."} Tidak ada data yang dihapus.` };
  revalidatePath("/settings/academic-year");
  revalidatePath("/classes");
  revalidatePath("/dashboard");
  return { ok: true, name: d.name, message: `Tahun ajaran ${d.name} dihapus.` };
}

/** Mengubah nama dan tanggal tahun ajaran (misalnya salah isi tanggal). Tahun ajaran yang diarsipkan tidak dapat diubah. Tercatat di audit. */
export async function updateYearAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole(ADMIN_ROLES);
  const id = String(fd.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, message: "Data tidak valid." };
  const parsed = yearSchema.safeParse({ name: fd.get("name") ?? "", start_date: fd.get("start_date") ?? "", end_date: fd.get("end_date") ?? "" });
  if (!parsed.success) return { ok: false, fieldErrors: zodFieldErrors(parsed.error) };
  const supabase = await createClient();
  const { data, error } = await supabase.from("academic_years").update(parsed.data).eq("id", id).eq("is_archived", false).select("id");
  if (error) {
    if (error.code === "23505") return { ok: false, fieldErrors: { name: "Tahun ajaran dengan nama itu sudah ada." } };
    return { ok: false, message: friendlyDbError(error) };
  }
  if (!data || data.length === 0) return { ok: false, message: "Tahun ajaran tidak ditemukan atau sudah diarsipkan sehingga tidak dapat diubah." };
  revalidatePath("/settings/academic-year");
  revalidatePath("/classes");
  return { ok: true, message: "Tahun ajaran diperbarui." };
}