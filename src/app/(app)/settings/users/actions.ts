"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ADMIN_ROLES, ROLES, type Role } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError, zodFieldErrors, type ActionState } from "@/lib/validation/common";
import { createUserSchema } from "@/lib/validation/settings";
import { createAccount, manageable, writeUserAudit } from "@/lib/users/create-account";

async function targetRoles(userId: string): Promise<Role[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r) => r.role as Role);
}

const audit = writeUserAudit;

export async function createUserAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const caller = await requireRole(ADMIN_ROLES);
  const parsed = createUserSchema.safeParse({
    full_name: fd.get("full_name") ?? "", email: fd.get("email") ?? "", phone: fd.get("phone") ?? "",
    role: fd.get("role") ?? "", student_ids: fd.getAll("student_ids").map(String), relationship: fd.get("relationship") || undefined,
    mode: fd.get("mode") || undefined,
  });
  if (!parsed.success) return { ok: false, fieldErrors: zodFieldErrors(parsed.error) };
  const r = await createAccount(caller.id, caller.roles, parsed.data);
  if (!r.ok) return { ok: false, message: r.message };
  revalidatePath("/settings/users");
  return { ok: true, message: parsed.data.mode === "google" ? "Akun didaftarkan. Pengguna masuk dengan tombol Google memakai email ini." : "Akun dibuat dan undangan dikirim ke email pengguna." };
}

export async function setUserActiveAction(userId: string, active: boolean): Promise<ActionState> {
  const caller = await requireRole(ADMIN_ROLES);
  if (!z.string().uuid().safeParse(userId).success) return { ok: false, message: "Data tidak valid." };
  if (userId === caller.id) return { ok: false, message: "Anda tidak dapat menonaktifkan akun Anda sendiri." };
  const roles = await targetRoles(userId);
  const allowed = manageable(caller.roles);
  if (roles.some((r) => !allowed.includes(r))) return { ok: false, message: "Anda tidak berwenang mengubah akun dengan peran ini." };
  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ is_active: active }).eq("id", userId);
  if (error) return { ok: false, message: friendlyDbError(error) };
  let cleared = 0;
  if (!active) {
    const { data: n } = await admin.rpc("clear_homeroom_for_user", { p_user: userId, p_reason: "akun dinonaktifkan" });
    cleared = Number(n ?? 0);
  }
  await audit(caller.id, active ? "activate_user" : "deactivate_user", userId, { homeroom_cleared: cleared });
  revalidatePath("/settings/users");
  revalidatePath("/classes");
  return { ok: true, message: active ? "Akun diaktifkan." : `Akun dinonaktifkan. Pengguna tidak dapat masuk.${cleared ? ` Wali kelas ${cleared} kelas dikosongkan; tetapkan wali pengganti di menu Kelas.` : ""}` };
}

export async function setUserRolesAction(userId: string, roles: string[]): Promise<ActionState> {
  const caller = await requireRole(ADMIN_ROLES);
  const parsed = z.object({ id: z.string().uuid(), roles: z.array(z.enum(ROLES)).min(1, "Pilih minimal satu peran.") }).safeParse({ id: userId, roles });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  const next = [...new Set(parsed.data.roles)];
  const allowed = manageable(caller.roles);
  const current = await targetRoles(userId);
  // Pemanggil tidak boleh menyentuh peran di luar wewenangnya, baik menambah maupun mencabut.
  const touched = [...next.filter((r) => !current.includes(r)), ...current.filter((r) => !next.includes(r))];
  if (touched.some((r) => !allowed.includes(r))) return { ok: false, message: "Anda tidak berwenang mengubah peran tersebut." };
  if (userId === caller.id && !next.includes("super_admin") && caller.roles.includes("super_admin")) return { ok: false, message: "Anda tidak dapat mencabut peran Super Admin Anda sendiri." };
  if (next.includes("parent") && next.some((r) => r !== "parent")) return { ok: false, message: "Peran orang tua tidak boleh digabung dengan peran staf." };

  const admin = createAdminClient();
  if (current.includes("super_admin") && !next.includes("super_admin")) {
    const { count } = await admin.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "super_admin");
    if ((count ?? 0) <= 1) return { ok: false, message: "Minimal satu Super Admin harus tetap ada." };
  }
  const toAdd = next.filter((r) => !current.includes(r)).map((role) => ({ user_id: userId, role, granted_by: caller.id }));
  const toRemove = current.filter((r) => !next.includes(r));
  if (toAdd.length) { const { error } = await admin.from("user_roles").insert(toAdd); if (error) return { ok: false, message: friendlyDbError(error) }; }
  if (toRemove.length) { const { error } = await admin.from("user_roles").delete().eq("user_id", userId).in("role", toRemove); if (error) return { ok: false, message: friendlyDbError(error) }; }
  if (toRemove.includes("teacher")) await admin.rpc("clear_homeroom_for_user", { p_user: userId, p_reason: "peran guru dicabut" });
  if (next.includes("parent")) {
    const { error } = await admin.from("parents").upsert({ profile_id: userId }, { onConflict: "profile_id" });
    if (error) return { ok: false, message: friendlyDbError(error) };
  }
  await audit(caller.id, "set_roles", userId, { from: current, to: next });
  revalidatePath("/settings/users");
  revalidatePath(`/settings/users/${userId}`);
  return { ok: true, message: "Peran diperbarui." };
}

export async function linkStudentAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const caller = await requireRole(ADMIN_ROLES);
  const parsed = z.object({ parent_id: z.string().uuid(), student_id: z.string().uuid("Pilih siswa."), relationship: z.enum(["ayah", "ibu", "wali"], { errorMap: () => ({ message: "Pilih hubungan." }) }) })
    .safeParse({ parent_id: fd.get("parent_id"), student_id: fd.get("student_id"), relationship: fd.get("relationship") });
  if (!parsed.success) return { ok: false, fieldErrors: zodFieldErrors(parsed.error) };
  const supabase = await createClient(); // RLS: psl_write hanya untuk administrator
  const { error } = await supabase.from("parent_student_links").upsert({ ...parsed.data, is_active: true }, { onConflict: "parent_id,student_id" });
  if (error) return { ok: false, message: friendlyDbError(error) };
  await audit(caller.id, "link_student", parsed.data.parent_id, { student_id: parsed.data.student_id });
  revalidatePath("/settings/users", "layout");
  return { ok: true, message: "Siswa dihubungkan." };
}

export async function unlinkStudentAction(linkId: string): Promise<ActionState> {
  await requireRole(ADMIN_ROLES);
  if (!z.string().uuid().safeParse(linkId).success) return { ok: false, message: "Data tidak valid." };
  const supabase = await createClient();
  // Dinonaktifkan, bukan dihapus, agar riwayat tetap ada. Akses orang tua langsung berhenti.
  const { error } = await supabase.from("parent_student_links").update({ is_active: false }).eq("id", linkId);
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/settings/users", "layout");
  return { ok: true, message: "Tautan dinonaktifkan." };
}

/** Kirim ulang tautan pembuatan kata sandi (undangan kedaluwarsa atau email tidak sampai). Dikirim lewat SMTP Supabase. */
export async function resendInviteAction(userId: string): Promise<ActionState> {
  const caller = await requireRole(ADMIN_ROLES);
  if (!z.string().uuid().safeParse(userId).success) return { ok: false, message: "Data tidak valid." };
  const roles = await targetRoles(userId);
  if (roles.some((r) => !manageable(caller.roles).includes(r))) return { ok: false, message: "Anda tidak berwenang mengirim undangan untuk akun ini." };
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(userId);
  const email = data?.user?.email;
  if (error || !email) return { ok: false, message: "Akun tidak ditemukan." };
  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { error: sendErr } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/callback?next=/reset-password` });
  if (sendErr) return { ok: false, message: /rate|limit/i.test(sendErr.message) ? "Terlalu sering mengirim. Coba lagi beberapa menit lagi." : "Email gagal dikirim. Periksa pengaturan SMTP." };
  await audit(caller.id, "resend_invite", userId, {});
  return { ok: true, message: "Tautan pembuatan kata sandi dikirim ulang." };
}

// ------------------------------------------------------------------ Hapus akun (khusus Super Admin)
export type DeleteAccountsResult = {
  ok: boolean;
  message?: string;
  total?: number;
  deletable?: { id: string; name: string; email: string | null }[];
  blocked?: { id: string; name: string; reason: string }[];
  deleted?: number;
};

const FOOTPRINT_LABEL: Record<string, string> = {
  "attendance_records.recorded_by": "mencatat absensi",
  "attendance_corrections.corrected_by": "mengoreksi absensi",
  "attendance_sessions.created_by": "membuat sesi absensi",
  "class_homeroom_history.teacher_id": "pernah menjadi wali kelas",
  "class_homeroom_history.changed_by": "mengubah wali kelas",
  "classes.homeroom_teacher_id": "saat ini menjadi wali kelas",
  "dispensation_students.confirmed_by": "mengonfirmasi dispensasi",
  "dispensations.requested_by": "mengajukan dispensasi",
  "dispensations.reviewed_by": "meninjau dispensasi",
  "dispensations.supervisor_id": "menjadi pendamping dispensasi",
  "early_dismissal_handover_logs.responsible_staff_id": "melakukan serah terima siswa",
  "early_dismissal_requests.requested_by": "mengajukan pulang lebih awal",
  "early_dismissal_requests.reviewed_by": "meninjau pulang lebih awal",
  "permission_documents.uploaded_by": "mengunggah dokumen izin",
  "permission_request_events.actor_id": "tercatat pada riwayat izin",
  "permission_requests.requested_by": "mengajukan izin atau sakit",
  "permission_requests.reviewed_by": "meninjau izin atau sakit",
  "school_calendar.created_by": "mengisi kalender sekolah",
  "student_qr_tokens.issued_by": "menerbitkan kode QR",
  "student_qr_tokens.revoked_by": "mencabut kode QR",
  "system_settings.updated_by": "mengubah pengaturan sistem",
  "user_roles.granted_by": "memberi peran kepada pengguna lain",
};

async function evaluateDeletion(callerId: string, ids: string[]): Promise<{ deletable: NonNullable<DeleteAccountsResult["deletable"]>; blocked: NonNullable<DeleteAccountsResult["blocked"]> }> {
  const admin = createAdminClient();
  const deletable: NonNullable<DeleteAccountsResult["deletable"]> = [];
  const blocked: NonNullable<DeleteAccountsResult["blocked"]> = [];
  for (const id of ids) {
    const { data: prof } = await admin.from("profiles").select("full_name").eq("id", id).maybeSingle();
    const name = prof?.full_name ?? "Akun tidak ditemukan";
    if (!prof) { blocked.push({ id, name, reason: "Akun tidak ditemukan." }); continue; }
    if (id === callerId) { blocked.push({ id, name, reason: "Akun Anda sendiri tidak dapat dihapus." }); continue; }
    const roles = await targetRoles(id);
    if (roles.includes("super_admin")) { blocked.push({ id, name, reason: "Akun Super Admin tidak dapat dihapus dari sini." }); continue; }
    const { data: fp, error } = await admin.rpc("account_footprint", { p_user: id });
    if (error) { blocked.push({ id, name, reason: "Pemeriksaan aktivitas gagal. Tidak dihapus demi keamanan." }); continue; }
    const keys = Object.keys((fp ?? {}) as Record<string, number>);
    if (keys.length > 0) {
      const why = [...new Set(keys.map((k) => FOOTPRINT_LABEL[k] ?? "memiliki aktivitas lain"))].join(", ");
      blocked.push({ id, name, reason: `Akun pernah ${why}. Nonaktifkan saja agar riwayat utuh.` });
      continue;
    }
    const { data: au } = await admin.auth.admin.getUserById(id);
    deletable.push({ id, name, email: au?.user?.email ?? null });
  }
  return { deletable, blocked };
}

const idsSchema = z.array(z.string().uuid()).min(1, "Pilih akun.").max(100, "Maksimal 100 akun sekaligus.");

/** Pratinjau: tidak menghapus apa pun. */
export async function previewDeleteAccountsAction(ids: string[]): Promise<DeleteAccountsResult> {
  const caller = await requireRole(["super_admin"]);
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  const { deletable, blocked } = await evaluateDeletion(caller.id, [...new Set(parsed.data)]);
  return { ok: true, total: parsed.data.length, deletable, blocked };
}

/** Hapus permanen akun yang tidak punya jejak. Pemeriksaan diulang di server; daftar dari peramban tidak dipercaya. */
export async function deleteAccountsAction(ids: string[], confirm: string): Promise<DeleteAccountsResult> {
  const caller = await requireRole(["super_admin"]);
  if (confirm !== "HAPUS") return { ok: false, message: "Ketik HAPUS (huruf besar) untuk melanjutkan." };
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  const { deletable, blocked } = await evaluateDeletion(caller.id, [...new Set(parsed.data)]);
  const admin = createAdminClient();
  let deleted = 0;
  for (const d of deletable) {
    const { error } = await admin.auth.admin.deleteUser(d.id); // profil, peran, tautan orang tua, dan notifikasi ikut terhapus
    if (error) { blocked.push({ id: d.id, name: d.name, reason: "Gagal dihapus. Coba lagi." }); continue; }
    deleted++;
    await audit(caller.id, "delete_user", d.id, { name_length: d.name.length, email_domain: d.email?.split("@")[1] ?? null });
  }
  revalidatePath("/settings/users");
  return { ok: true, deleted, blocked, message: `${deleted} akun dihapus permanen.` };
}

// ------------------------------------------------------------------ Orang tua tanpa anak aktif
export async function deactivateOrphanParentsAction(): Promise<ActionState> {
  await requireRole(ADMIN_ROLES);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("deactivate_orphan_parents", { p_dry: false });
  if (error) return { ok: false, message: friendlyDbError(error) };
  const n = Number((data as { count?: number } | null)?.count ?? 0);
  revalidatePath("/settings/users");
  return { ok: true, message: n > 0 ? `${n} akun orang tua dinonaktifkan. Riwayat tetap tersimpan dan akun dapat diaktifkan kembali.` : "Tidak ada akun yang perlu dinonaktifkan." };
}