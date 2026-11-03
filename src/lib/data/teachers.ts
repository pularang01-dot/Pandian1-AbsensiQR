import "server-only";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/data/students";

/** Daftar akun berperan guru (untuk wali kelas / guru pendamping). Dibatasi RLS. */
export async function loadTeachers(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("user_roles").select("user_id, profiles(full_name, is_active)").eq("role", "teacher");
  return (data ?? [])
    .map((r) => {
      const p = one(r.profiles as { full_name: string; is_active: boolean } | { full_name: string; is_active: boolean }[] | null);
      return p?.is_active ? { id: r.user_id as string, name: p.full_name } : null;
    })
    .filter((t): t is { id: string; name: string } => t !== null)
    .sort((a, b) => a.name.localeCompare(b.name, "id"));
}
