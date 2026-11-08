"use server";

import { createClient } from "@/lib/supabase/server";

/** Melaporkan error yang terjadi di peramban pengguna. Gagal diam-diam: tidak boleh mengganggu pengguna. */
export async function reportClientErrorAction(input: { message: string; route?: string; digest?: string }): Promise<void> {
  try {
    const message = String(input?.message ?? "").slice(0, 300);
    if (!message) return;
    const supabase = await createClient();
    await supabase.rpc("log_app_error", {
      p_source: "client",
      p_route: String(input?.route ?? "").slice(0, 200) || null,
      p_message: message,
      p_digest: input?.digest ? String(input.digest).slice(0, 60) : null,
      p_detail: null,
    });
  } catch {
    /* diabaikan */
  }
}