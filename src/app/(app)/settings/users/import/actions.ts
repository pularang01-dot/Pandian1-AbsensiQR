"use server";

import { revalidatePath } from "next/cache";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAccount, manageable } from "@/lib/users/create-account";
import { staffRowSchema, staffRowsSchema, type StaffImportResult } from "@/lib/validation/staff-import";

/**
 * Impor akun staf dari berkas. Tiap baris diproses sendiri: baris gagal tidak membatalkan baris lain.
 * Orang tua tidak termasuk (memerlukan tautan siswa); buat lewat form Pengguna.
 * Diproses berurutan agar tidak menembus batas pengiriman SMTP.
 */
export async function importStaffAction(rows: unknown, mode: "invite" | "google" = "invite"): Promise<StaffImportResult> {
  const caller = await requireRole(ADMIN_ROLES);
  if (mode !== "invite" && mode !== "google") return { ok: false, message: "Cara masuk tidak valid." };
  const list = staffRowsSchema.safeParse(rows);
  if (!list.success) return { ok: false, message: list.error.issues[0]?.message ?? "Data tidak valid." };

  const supabase = await createClient();
  const { data: year } = await supabase.from("academic_years").select("id").eq("is_active", true).maybeSingle();
  const allowed = manageable(caller.roles);
  const seen = new Set<string>();
  const results: NonNullable<StaffImportResult["results"]> = [];
  let created = 0;

  for (const [i, raw] of list.data.entries()) {
    const line = i + 2; // baris 1 = judul kolom
    const p = staffRowSchema.safeParse(raw);
    const email = typeof (raw as { email?: unknown })?.email === "string" ? String((raw as { email: string }).email).trim().toLowerCase() : "";
    if (!p.success) { results.push({ line, email, status: "gagal", message: p.error.issues[0]?.message ?? "Baris tidak valid." }); continue; }
    const v = p.data;
    if (seen.has(v.email)) { results.push({ line, email: v.email, status: "dilewati", message: "Email ganda di dalam berkas." }); continue; }
    seen.add(v.email);
    if (!allowed.includes(v.role)) { results.push({ line, email: v.email, status: "gagal", message: "Anda tidak berwenang memberi peran ini (hanya Super Admin)." }); continue; }

    // Wali kelas: kelas harus ada di tahun ajaran aktif dan belum memiliki wali. Diperiksa SEBELUM akun dibuat.
    let classId: string | null = null;
    if (v.class_name) {
      if (v.role !== "teacher") { results.push({ line, email: v.email, status: "gagal", message: "Kolom Kelas hanya untuk peran Guru." }); continue; }
      const { data: cls } = year
        ? await supabase.from("classes").select("id, homeroom_teacher_id").eq("academic_year_id", year.id).ilike("name", v.class_name).maybeSingle()
        : { data: null };
      if (!cls) { results.push({ line, email: v.email, status: "gagal", message: `Kelas ${v.class_name} tidak ditemukan pada tahun ajaran aktif.` }); continue; }
      if (cls.homeroom_teacher_id) { results.push({ line, email: v.email, status: "gagal", message: `Kelas ${v.class_name} sudah memiliki wali kelas. Ubah lewat menu Kelas.` }); continue; }
      classId = cls.id;
    }

    const r = await createAccount(caller.id, caller.roles, { full_name: v.full_name, email: v.email, phone: v.phone, role: v.role, mode });
    if (!r.ok) { results.push({ line, email: v.email, status: "gagal", message: r.message }); continue; }
    created++;
    if (classId) {
      const { error } = await supabase.from("classes").update({ homeroom_teacher_id: r.userId }).eq("id", classId).is("homeroom_teacher_id", null);
      results.push({ line, email: v.email, status: "dibuat", message: error ? "Akun dibuat, tetapi wali kelas gagal ditetapkan. Atur lewat menu Kelas." : `Akun dibuat, wali kelas ${v.class_name}.` });
    } else {
      results.push({ line, email: v.email, status: "dibuat", message: mode === "google" ? "Akun didaftarkan untuk login Google." : "Akun dibuat dan undangan dikirim." });
    }
  }
  revalidatePath("/settings/users");
  revalidatePath("/classes");
  return { ok: true, created, results };
}