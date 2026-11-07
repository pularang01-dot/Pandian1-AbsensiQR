"use server";

import { revalidatePath } from "next/cache";
import { APPROVER_ROLES, type Role } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { sanitizeSearch, friendlyDbError, type ActionState } from "@/lib/validation/common";
import { classAttendanceSchema, backdatedAttendanceSchema, correctionSchema, recordAttendanceSchema, RESULT_MESSAGE, type RpcResult } from "@/lib/validation/attendance";
import { one } from "@/lib/data/students";

const SCAN_ROLES: Role[] = ["super_admin", "school_admin", "teacher", "operator"];
const NETWORK_FAIL: RpcResult = { result: "error", message: "Gagal terhubung ke server. Data BELUM tersimpan." };

export async function lookupQrAction(token: string): Promise<RpcResult> {
  await requireRole(SCAN_ROLES);
  if (typeof token !== "string" || token.length < 8 || token.length > 128) return { result: "invalid", message: RESULT_MESSAGE.invalid };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("lookup_qr_token", { p_token: token });
  if (error || !data) return error ? { result: "error", message: friendlyDbError(error) } : NETWORK_FAIL;
  const r = data as RpcResult;
  return { ...r, message: r.message ?? RESULT_MESSAGE[r.result] };
}

export async function recordAttendanceAction(input: unknown): Promise<RpcResult> {
  await requireRole(SCAN_ROLES);
  const parsed = recordAttendanceSchema.safeParse(input);
  if (!parsed.success) return { result: "error", message: parsed.error.issues[0]?.message ?? "Data tidak valid." };

  const supabase = await createClient();
  const p = parsed.data;
  const { data, error } = await supabase.rpc("record_attendance", {
    p_student_id: p.student_id,
    p_source: p.source,
    p_qr_token: p.source === "qr" ? p.token : null,
    p_status: p.source === "manual" ? p.status : null,
    p_note: p.source === "manual" ? p.note : null,
  });
  // Keberhasilan HANYA dilaporkan bila database mengonfirmasi 'recorded'.
  if (error) return { result: "error", message: `${friendlyDbError(error)} Data BELUM tersimpan.` };
  if (!data) return NETWORK_FAIL;
  const r = data as RpcResult;
  if (r.result === "recorded") revalidatePath("/attendance");
  return { ...r, message: r.message ?? RESULT_MESSAGE[r.result] };
}

export type StudentHit = { id: string; name: string; nis: string; className: string | null };

export async function searchStudentsAction(q: string): Promise<StudentHit[]> {
  await requireRole(SCAN_ROLES);
  const term = sanitizeSearch(q);
  if (term.length < 2) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("students")
    .select("id, nis, full_name, student_class_assignments(end_date, classes(name))")
    .eq("status", "active")
    .or(`full_name.ilike.%${term}%,nis.ilike.%${term}%`)
    .order("full_name")
    .limit(8);
  return (data ?? []).map((s) => {
    const open = (s.student_class_assignments as { end_date: string | null; classes: { name: string } | { name: string }[] | null }[]).find((a) => a.end_date === null);
    return { id: s.id, name: s.full_name, nis: s.nis, className: open ? (one(open.classes)?.name ?? null) : null };
  });
}

export async function correctAttendanceAction(input: unknown): Promise<ActionState> {
  await requireRole([...APPROVER_ROLES, "teacher"]);
  const parsed = correctionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("correct_attendance", {
    p_record_id: parsed.data.record_id,
    p_new_status: parsed.data.new_status,
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/attendance");
  revalidatePath("/attendance/history");
  return { ok: true, message: "Koreksi tersimpan dan tercatat dalam riwayat perubahan." };
}

export async function reconcileAction(date: string, classId?: string): Promise<ActionState & { marked?: number }> {
  await requireRole(["super_admin", "school_admin", "teacher"]);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, message: "Tanggal tidak valid." };
  if (classId !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(classId)) return { ok: false, message: "Kelas tidak valid." };
  const supabase = await createClient();
  // Hak akses sebenarnya ditegakkan di basis data: wali kelas hanya dapat merekonsiliasi kelasnya sendiri.
  const { data, error } = await supabase.rpc("reconcile_attendance", { p_date: date, p_class: classId ?? null });
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/attendance");
  revalidatePath("/dashboard");
  const n = Number(data ?? 0);
  return { ok: true, marked: n, message: classId ? `Rekonsiliasi kelas selesai. ${n} siswa tanpa catatan ditandai Alpa.` : `Rekonsiliasi selesai. ${n} siswa tanpa catatan ditandai Alpa dan sesi ditutup.` };
}

export type ClassAttendanceResult = { ok: boolean; message: string; inserted?: number; skipped?: number };

const CLASS_RESULT_MESSAGE: Record<string, string> = {
  forbidden: "Anda hanya dapat mengabsen kelas yang Anda ampu.",
  invalid: "Data tidak valid. Muat ulang halaman lalu coba lagi.",
  not_school_day: "Hari ini bukan hari sekolah.",
  session_closed: "Sesi absensi hari ini sudah ditutup.",
};

/** Menyimpan absensi satu kelas sekaligus. Hak akses, validasi, dan sifat tidak-menimpa ditegakkan di basis data. */
export async function recordClassAttendanceAction(input: unknown): Promise<ClassAttendanceResult> {
  await requireRole(SCAN_ROLES);
  const parsed = classAttendanceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_class_attendance", {
    p_class: parsed.data.class_id,
    p_entries: parsed.data.entries.map((e) => ({ student_id: e.student_id, status: e.status, note: e.note ?? null })),
    p_default_note: null,
  });
  if (error) return { ok: false, message: `${friendlyDbError(error)} Data BELUM tersimpan.` };
  const r = (data ?? {}) as { result?: string; message?: string; inserted?: number; skipped?: unknown[] };
  if (r.result !== "recorded") return { ok: false, message: `${r.message ?? CLASS_RESULT_MESSAGE[r.result ?? ""] ?? "Gagal menyimpan."} Data BELUM tersimpan.` };
  revalidatePath("/attendance");
  revalidatePath("/attendance/class");
  revalidatePath("/dashboard");
  const skipped = r.skipped?.length ?? 0;
  return {
    ok: true,
    inserted: r.inserted ?? 0,
    skipped,
    message: skipped > 0
      ? `${r.inserted ?? 0} catatan tersimpan. ${skipped} siswa sudah tercatat sebelumnya dan tidak diubah.`
      : `${r.inserted ?? 0} catatan absensi tersimpan.`,
  };
}

/** Absensi susulan untuk tanggal lampau (khusus admin, alasan wajib). Aturan ditegakkan di basis data dan tercatat di audit. */
export async function recordBackdatedAttendanceAction(input: unknown): Promise<ClassAttendanceResult> {
  await requireRole(["super_admin", "school_admin"]);
  const parsed = backdatedAttendanceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_class_attendance_backdated", {
    p_class: parsed.data.class_id,
    p_date: parsed.data.date,
    p_entries: parsed.data.entries.map((e) => ({ student_id: e.student_id, status: e.status, note: e.note ?? null })),
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, message: `${friendlyDbError(error)} Data BELUM tersimpan.` };
  const r = (data ?? {}) as { result?: string; message?: string; inserted?: number; skipped?: unknown[] };
  if (r.result !== "recorded") return { ok: false, message: `${r.message ?? "Gagal menyimpan."} Data BELUM tersimpan.` };
  revalidatePath("/attendance");
  revalidatePath("/attendance/class");
  revalidatePath("/dashboard");
  revalidatePath("/activity");
  const skipped = r.skipped?.length ?? 0;
  return {
    ok: true,
    inserted: r.inserted ?? 0,
    skipped,
    message: skipped > 0
      ? `${r.inserted ?? 0} catatan susulan tersimpan. ${skipped} siswa sudah tercatat sebelumnya dan tidak diubah.`
      : `${r.inserted ?? 0} catatan susulan tersimpan.`,
  };
}