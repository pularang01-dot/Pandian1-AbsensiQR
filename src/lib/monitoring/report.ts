import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Mencatat error ke tabel app_errors lewat fungsi log_app_error (penyamaran email/angka/id dilakukan di basis data).
 * Tidak pernah melempar error: pemantau tidak boleh menjadi sumber error baru.
 */
export async function reportServerError(input: { source: "server" | "client" | "action"; route?: string; message: string; digest?: string; detail?: string }): Promise<void> {
  try {
    const sb = createAdminClient();
    await sb.rpc("log_app_error", {
      p_source: input.source,
      p_route: input.route ?? null,
      p_message: input.message,
      p_digest: input.digest ?? null,
      p_detail: input.detail ?? null,
    });
  } catch {
    /* sengaja diabaikan */
  }
}