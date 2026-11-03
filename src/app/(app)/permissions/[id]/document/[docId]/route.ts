import { NextResponse, type NextRequest } from "next/server";
import { STAFF_ROLES } from "@/lib/auth/roles";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { asUuid } from "@/lib/data/lookups";

export const dynamic = "force-dynamic";

/** Mengalihkan ke signed URL berumur 60 detik. Akses diperiksa RLS pada tabel dan pada storage. Tidak ada URL publik. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sesi berakhir. Silakan masuk kembali." }, { status: 401 });
  if (!user.roles.some((r) => STAFF_ROLES.includes(r))) return NextResponse.json({ error: "Tidak berwenang." }, { status: 403 });

  const p = await params;
  const id = asUuid(p.id);
  const docId = asUuid(p.docId);
  if (!id || !docId) return NextResponse.json({ error: "Dokumen tidak ditemukan." }, { status: 404 });

  const supabase = await createClient();
  const { data: doc } = await supabase.from("permission_documents").select("storage_path").eq("id", docId).eq("request_id", id).maybeSingle();
  if (!doc) return NextResponse.json({ error: "Dokumen tidak ditemukan atau Anda tidak berwenang." }, { status: 404 });

  const { data, error } = await supabase.storage.from("permission-documents").createSignedUrl(doc.storage_path, 60);
  if (error || !data) return NextResponse.json({ error: "Dokumen tidak dapat dibuka. Coba lagi." }, { status: 500 });

  const res = NextResponse.redirect(data.signedUrl);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
