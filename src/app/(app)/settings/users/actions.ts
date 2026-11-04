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