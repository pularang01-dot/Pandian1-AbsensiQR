import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isRole } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

const OTP_TYPES: EmailOtpType[] = ["invite", "recovery", "signup", "magiclink", "email"];

/**
 * Penukar tautan email (pemulihan kata sandi dan undangan) menjadi sesi.
 * Mendukung alur PKCE (?code=) dan templat email berbasis token_hash (?token_hash=&type=).
 * Tujuan akhir dibatasi ke jalur internal agar tidak menjadi open redirect.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const next = sp.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/reset-password";
  const fail = () => NextResponse.redirect(new URL("/forgot-password?error=link", request.url));
  const failLogin = (reason: string) => NextResponse.redirect(new URL(`/login?error=${reason}`, request.url));

  const supabase = await createClient();
  const code = sp.get("code");
  const tokenHash = sp.get("token_hash");
  const type = sp.get("type") as EmailOtpType | null;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user) return safeNext === "/reset-password" ? fail() : failLogin("google");
    // Alur reset/undangan memang boleh untuk akun yang belum aktif. Alur login (Google) tidak:
    // akun harus sudah dibuat administrator, aktif, dan punya peran. Selain itu sesi ditutup.
    if (safeNext !== "/reset-password") {
      const [{ data: profile }, { data: roleRows }] = await Promise.all([
        supabase.from("profiles").select("is_active").eq("id", data.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", data.user.id),
      ]);
      const hasRole = (roleRows ?? []).some((r) => isRole(r.role));
      if (!profile?.is_active || !hasRole) {
        await supabase.auth.signOut();
        return failLogin("not_registered");
      }
    }
    return NextResponse.redirect(new URL(safeNext, request.url));
  }
  if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    return error ? fail() : NextResponse.redirect(new URL(safeNext, request.url));
  }
  return fail();
}