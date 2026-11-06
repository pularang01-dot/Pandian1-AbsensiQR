import { Readable, pipeline } from "node:stream";
import { createCipheriv, pbkdf2, randomBytes } from "node:crypto";
import { createGzip } from "node:zlib";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { BACKUP_MAGIC, BACKUP_TABLES, MIN_PASSPHRASE, PBKDF2_ITERATIONS } from "@/lib/backup/tables";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const pbkdf2Async = promisify(pbkdf2) as (p: string, s: Buffer, i: number, len: number, d: string) => Promise<Buffer>;
const PAGE = 1000;

/**
 * Cadangan terenkripsi (AES-256-GCM, kunci dari kata sandi lewat PBKDF2-SHA256) berformat NDJSON yang di-gzip.
 * Hanya super_admin. Kata sandi cadangan tidak disimpan di mana pun; tanpa kata sandi berkas tidak dapat dibuka.
 * Kunci service-role hanya dipakai di server; isi cadangan dikirim langsung ke pemanggil.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Sesi berakhir. Masuk kembali." }, { status: 401 });
  if (!user.roles.includes("super_admin")) return NextResponse.json({ message: "Hanya super admin yang boleh membuat cadangan." }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const pass = String(form?.get("passphrase") ?? "");
  const pass2 = String(form?.get("passphrase2") ?? "");
  const ack = String(form?.get("ack") ?? "");
  if (ack !== "ya") return NextResponse.json({ message: "Centang pernyataan tanggung jawab data terlebih dahulu." }, { status: 400 });
  if (pass.length < MIN_PASSPHRASE) return NextResponse.json({ message: `Kata sandi cadangan minimal ${MIN_PASSPHRASE} karakter.` }, { status: 400 });
  if (pass !== pass2) return NextResponse.json({ message: "Kedua isian kata sandi cadangan tidak sama." }, { status: 400 });

  const admin = createAdminClient();
  const uid = user.id;
  const stamp = new Date().toISOString();
  await admin.from("audit_logs").insert({ actor_id: uid, action: "backup_started", entity_table: "backup", new_data: { at: stamp } });

  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await pbkdf2Async(pass, salt, PBKDF2_ITERATIONS, 32, "sha256");
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  async function* lines(): AsyncGenerator<string> {
    const counts: Record<string, number> = {};
    yield JSON.stringify({ t: "meta", app: "pandian-smart-attendance", format: 1, created_at: stamp, tables: BACKUP_TABLES.map((t) => t.name) }) + "\n";

    // Akun login (tanpa kata sandi: Supabase tidak mengizinkan kata sandi diekspor).
    let page = 1;
    let authCount = 0;
    for (;;) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Error("Gagal membaca daftar akun: " + error.message);
      for (const u of data.users) {
        authCount++;
        yield JSON.stringify({ t: "auth", row: { id: u.id, email: u.email ?? null, created_at: u.created_at } }) + "\n";
      }
      if (data.users.length < 1000) break;
      page++;
    }
    counts["auth.users"] = authCount;

    for (const tb of BACKUP_TABLES) {
      let from = 0;
      let n = 0;
      for (;;) {
        let q = admin.from(tb.name).select("*");
        for (const c of tb.pk.split(",")) q = q.order(c, { ascending: true });
        const { data, error } = await q.range(from, from + PAGE - 1);
        if (error) throw new Error(`Gagal membaca tabel ${tb.name}: ${error.message}`);
        for (const row of data ?? []) { n++; yield JSON.stringify({ t: tb.name, row }) + "\n"; }
        if (!data || data.length < PAGE) break;
        from += PAGE;
      }
      counts[tb.name] = n;
    }
    yield JSON.stringify({ t: "end", counts }) + "\n";
    await admin.from("audit_logs").insert({ actor_id: uid, action: "backup_completed", entity_table: "backup", new_data: { at: stamp, counts } });
  }

  // pipeline menghentikan semua tahap bila ada galat; berkas yang terpotong tidak punya tag sehingga ditolak saat dibuka.
  pipeline(Readable.from(lines(), { objectMode: false }), createGzip(), cipher, () => undefined);

  // Berkas = MAGIC | salt(16) | iv(12) | ciphertext... | tag(16)
  const out = Readable.from((async function* () {
    yield Buffer.from(BACKUP_MAGIC, "utf8");
    yield salt;
    yield iv;
    for await (const chunk of cipher) yield chunk as Buffer;
    yield cipher.getAuthTag();
  })());
  out.on("error", () => undefined);

  const name = `cadangan-pandian-${stamp.slice(0, 10)}.psabak`;
  return new Response(Readable.toWeb(out) as ReadableStream, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}