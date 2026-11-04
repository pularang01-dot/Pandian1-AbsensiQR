import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type AuthInfo = { email: string | null; lastSignIn: string | null; createdAt: string | null };

/** Email dan waktu masuk terakhir dari Supabase Auth (butuh kunci service-role, hanya server). Maks 1000 akun. */
export async function loadAuthInfo(): Promise<Map<string, AuthInfo>> {
  const out = new Map<string, AuthInfo>();
  try {
    const admin = createAdminClient();
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const u of data?.users ?? []) out.set(u.id, { email: u.email ?? null, lastSignIn: u.last_sign_in_at ?? null, createdAt: u.created_at ?? null });
  } catch {
    // Bila kunci belum dikonfigurasi, halaman tetap tampil tanpa informasi ini.
  }
  return out;
}