"use server";

import { revalidatePath } from "next/cache";
import { ADMIN_ROLES, APPROVER_ROLES, type Role } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { sanitizeSearch, friendlyDbError, type ActionState } from "@/lib/validation/common";
import { correctionSchema, recordAttendanceSchema, RESULT_MESSAGE, type RpcResult } from "@/lib/validation/attendance";
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

export async function reconcileAction(date: string): Promise<ActionState & { marked?: number }> {
  await requireRole(ADMIN_ROLES);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, message: "Tanggal tidak valid." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reconcile_attendance", { p_date: date });
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/attendance");
  revalidatePath("/dashboard");
  return { ok: true, marked: Number(data ?? 0), message: `Rekonsiliasi selesai. ${Number(data ?? 0)} siswa tanpa catatan ditandai Alpa dan sesi ditutup.` };
}
