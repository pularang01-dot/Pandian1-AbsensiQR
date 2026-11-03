"use server";

import { revalidatePath } from "next/cache";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError, zodFieldErrors, type ActionState } from "@/lib/validation/common";
import { attendanceSettingsSchema, calendarSchema, schoolSchema, yearSchema } from "@/lib/validation/settings";

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
    school_days: fd.getAll("school_days").map(String), doc_days: fd.get("doc_days") ?? "",
  });
  if (!parsed.success) return { ok: false, fieldErrors: zodFieldErrors(parsed.error) };
  const v = parsed.data;
  // Berlaku untuk sesi absensi yang dibuat setelah perubahan; sesi yang sudah ada tidak diubah.
  return saveSettings({
    "attendance.start_time": v.start_time, "attendance.late_after": v.late_after, "attendance.close_time": v.close_time,
    "attendance.school_days": [...new Set(v.school_days)].sort(), "permission.document_required_for_sick_days": v.doc_days,
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

export async function yearTransitionAction(id: string, op: "activate" | "archive"): Promise<ActionState> {
  await requireRole(ADMIN_ROLES);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, message: "Data tidak valid." };
  const supabase = await createClient();
  const { error } = await supabase.rpc(op === "activate" ? "activate_academic_year" : "archive_academic_year", { p_id: id });
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/settings/academic-year");
  return { ok: true, message: op === "activate" ? "Tahun ajaran diaktifkan." : "Tahun ajaran diarsipkan. Datanya tetap tersimpan." };
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
