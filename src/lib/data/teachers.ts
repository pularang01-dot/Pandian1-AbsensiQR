import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Daftar akun berperan guru yang aktif (untuk wali kelas). Dibatasi RLS.
 * Dua kueri terpisah sengaja dipakai: tabel user_roles punya dua relasi ke profiles
 * (user_id dan granted_by), sehingga kueri tertanam menjadi ambigu dan hasilnya kosong.
 */
export async function loadTeachers(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "teacher");
  const ids = [...new Set((roles ?? []).map((r) => r.user_id as string))];
  if (ids.length === 0) return [];
  const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids).eq("is_active", true);
  return (profs ?? [])
    .map((p) => ({ id: p.id as string, name: p.full_name as string }))
    .sort((a, b) => a.name.localeCompare(b.name, "id"));
}

/** Nama dan status akun untuk sejumlah id (wali kelas saat ini, termasuk yang sudah nonaktif). */
export async function loadProfileNames(ids: string[]): Promise<Map<string, { name: string; active: boolean }>> {
  const out = new Map<string, { name: string; active: boolean }>();
  const uniq = [...new Set(ids.filter(Boolean))];
  if (uniq.length === 0) return out;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, full_name, is_active").in("id", uniq);
  for (const p of data ?? []) out.set(p.id as string, { name: p.full_name as string, active: Boolean(p.is_active) });
  return out;
}