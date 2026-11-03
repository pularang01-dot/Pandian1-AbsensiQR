"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, forgotPasswordSchema, type ActionState } from "@/lib/validation/auth";
import { isRole, homePathFor } from "@/lib/auth/roles";

// Pembatas laju sederhana per-instans (cadangan; Supabase Auth juga membatasi laju di sisi server).
const attempts = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;

async function clientKey(email: string) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  return `${ip}|${email.toLowerCase()}`;
}

function tooMany(key: string) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now - entry.first > WINDOW_MS) {
    attempts.set(key, { count: 1, first: now });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

export async function signInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { ok: false, fieldErrors };
  }

  const key = await clientKey(parsed.data.email);
  if (tooMany(key)) {
    return { ok: false, message: "Terlalu banyak percobaan masuk. Coba lagi dalam beberapa menit." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    // Pesan sengaja generik agar tidak membocorkan apakah email terdaftar.
    return { ok: false, message: "Email atau kata sandi tidak sesuai." };
  }

  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase.from("profiles").select("is_active").eq("id", data.user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", data.user.id),
  ]);

  const roles = (roleRows ?? []).map((r) => r.role).filter(isRole);
  if (!profile?.is_active || roles.length === 0) {
    await supabase.auth.signOut();
    return {
      ok: false,
      message: "Akun Anda belum aktif atau belum memiliki peran. Hubungi administrator sekolah.",
    };
  }

  attempts.delete(key);
  const next = String(formData.get("next") ?? "");
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : null;
  redirect(safeNext ?? homePathFor(roles.includes("parent") && roles.length === 1 ? "parent" : roles[0]));
}

export async function forgotPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { ok: false, fieldErrors: { email: parsed.error.issues[0]?.message ?? "Email tidak valid." } };
  }

  const key = `reset|${await clientKey(parsed.data.email)}`;
  if (tooMany(key)) {
    return { ok: false, message: "Terlalu banyak permintaan. Coba lagi dalam beberapa menit." };
  }

  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: `${origin}/auth/callback?next=/reset-password` });

  // Respons sama apa pun hasilnya, untuk mencegah enumerasi akun.
  return {
    ok: true,
    message: "Jika email terdaftar, tautan pemulihan kata sandi telah dikirim. Periksa kotak masuk Anda.",
  };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Mulai login dengan Google. Pendaftaran mandiri dimatikan di Supabase, dan callback memeriksa bahwa email
 * sudah terdaftar, aktif, dan memiliki peran. Tanpa itu sesi langsung ditutup.
 */
export async function googleSignInAction(formData: FormData) {
  const next = String(formData.get("next") ?? "");
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeNext)}`, queryParams: { prompt: "select_account" } },
  });
  if (error || !data.url) redirect("/login?error=google");
  redirect(data.url);
}