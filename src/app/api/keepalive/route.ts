import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Penjaga agar proyek Supabase (paket gratis) tidak dijeda karena tidak aktif.
 * Dipanggil harian oleh Vercel Cron (lihat vercel.json). Vercel mengirim header
 * "Authorization: Bearer <CRON_SECRET>"; tanpa rahasia yang cocok, permintaan ditolak.
 * Hanya membaca satu baris pengaturan; tidak menulis apa pun dan tidak membuka data pribadi.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ ok: false, message: "CRON_SECRET belum diatur di environment." }, { status: 503 });
  const given = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(given), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ ok: false }, { status: 401 });

  const { error } = await createAdminClient().from("system_settings").select("key").limit(1);
  if (error) return NextResponse.json({ ok: false, message: "Database tidak merespons." }, { status: 500 });
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}