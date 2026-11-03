import "server-only";
import { ROLES, type Role } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";

/** Peran yang boleh diberikan/dikelola pemanggil. Hanya super_admin yang mengelola peran administratif dan penyetuju. */
export function manageable(callerRoles: Role[]): Role[] {
  return callerRoles.includes("super_admin") ? [...ROLES] : ["teacher", "operator", "parent"];
}

export type NewAccount = {
  full_name: string; email: string; phone?: string | null; role: Role;
  student_ids?: string[]; relationship?: "ayah" | "ibu" | "wali";
  /** invite: kirim email undangan buat kata sandi. google: daftarkan email tanpa email apa pun; pengguna masuk dengan Google. */
  mode?: "invite" | "google";
};
export type CreateResult = { ok: true; userId: string } | { ok: false; message: string };

export async function writeUserAudit(actor: string, action: string, entity: string, data: Record<string, unknown>) {
  const admin = createAdminClient();
  await admin.from("audit_logs").insert({ actor_id: actor, action, entity_table: "user_admin", entity_id: entity, new_data: data });
}

/**
 * Membuat satu akun lewat undangan email (pengirim email = SMTP yang diatur di Supabase, mis. Brevo).
 * Administrator tidak pernah menetapkan kata sandi. Bila langkah apa pun gagal, akun auth dihapus kembali.
 * Pemanggil WAJIB sudah memverifikasi bahwa ia admin (requireRole) sebelum memanggil fungsi ini.
 */
export async function createAccount(callerId: string, callerRoles: Role[], v: NewAccount): Promise<CreateResult> {
  if (!manageable(callerRoles).includes(v.role)) return { ok: false, message: "Anda tidak berwenang membuat akun dengan peran ini." };
  if (v.role === "parent" && ((v.student_ids ?? []).length === 0 || !v.relationship)) {
    return { ok: false, message: "Akun orang tua wajib dihubungkan ke minimal satu siswa beserta hubungannya." };
  }

  const admin = createAdminClient();
  let uid: string;
  if (v.mode === "google") {
    // Email dinyatakan terverifikasi tanpa kata sandi. Saat pengguna masuk dengan Google memakai email yang sama,
    // Supabase menautkannya ke akun ini. Tidak ada email yang dikirim (tidak memerlukan SMTP).
    const { data: made, error: mkErr } = await admin.auth.admin.createUser({ email: v.email, email_confirm: true, user_metadata: { full_name: v.full_name } });
    if (mkErr || !made.user) return { ok: false, message: /already|registered|exists/i.test(mkErr?.message ?? "") ? "Email ini sudah terdaftar." : "Akun gagal dibuat. Coba lagi." };
    uid = made.user.id;
  } else {
    const site = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const { data: invited, error: invErr } = await admin.auth.admin.inviteUserByEmail(v.email, {
      data: { full_name: v.full_name }, redirectTo: site ? `${site}/auth/callback?next=/reset-password` : undefined,
    });
    if (invErr || !invited.user) {
      const m = invErr?.message ?? "";
      if (/already|registered|exists/i.test(m)) return { ok: false, message: "Email ini sudah terdaftar." };
      if (/rate|limit/i.test(m)) return { ok: false, message: "Batas pengiriman email tercapai. Tunggu beberapa saat atau periksa kuota SMTP." };
      return { ok: false, message: "Undangan gagal dikirim. Periksa pengaturan SMTP di Supabase lalu coba lagi." };
    }
    uid = invited.user.id;
  }

  try {
    const { error: pErr } = await admin.from("profiles").update({ full_name: v.full_name, phone: v.phone || null, is_active: true }).eq("id", uid);
    if (pErr) throw pErr;
    const { error: rErr } = await admin.from("user_roles").insert({ user_id: uid, role: v.role, granted_by: callerId });
    if (rErr) throw rErr;
    if (v.role === "parent") {
      const { data: par, error: paErr } = await admin.from("parents").insert({ profile_id: uid }).select("id").single();
      if (paErr || !par) throw paErr;
      const { error: lErr } = await admin.from("parent_student_links").insert((v.student_ids ?? []).map((sid) => ({ parent_id: par.id, student_id: sid, relationship: v.relationship! })));
      if (lErr) throw lErr;
    }
  } catch {
    await admin.auth.admin.deleteUser(uid);
    return { ok: false, message: "Akun gagal dibuat dan dibatalkan. Periksa data lalu coba lagi." };
  }
  await writeUserAudit(callerId, "create_user", uid, { role: v.role, mode: v.mode ?? "invite", email_domain: v.email.split("@")[1] });
  return { ok: true, userId: uid };
}