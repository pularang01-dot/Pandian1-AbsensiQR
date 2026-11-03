import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Klien service-role. HANYA untuk kode server (Server Actions / Route Handlers)
 * dan HANYA setelah peran pemanggil diverifikasi (lihat requireRole).
 * Melewati RLS, sehingga jangan pernah diimpor dari komponen klien.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi di environment server.");
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
