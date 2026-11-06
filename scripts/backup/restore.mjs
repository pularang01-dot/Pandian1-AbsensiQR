#!/usr/bin/env node
/**
 * Alat pemilik: memeriksa dan memulihkan berkas cadangan (.psabak). TIDAK dijalankan dari aplikasi web.
 * Tanpa dependensi baru (memakai @supabase/supabase-js yang sudah ada di proyek).
 *
 *   node scripts/backup/restore.mjs verify  <berkas.psabak>     periksa berkas (tidak menyentuh database)
 *   node scripts/backup/restore.mjs restore <berkas.psabak>     uji coba: bandingkan dengan database (tidak mengubah apa pun)
 *   node scripts/backup/restore.mjs restore <berkas.psabak> --apply   pulihkan sungguhan (meminta konfirmasi)
 *
 * Kata sandi cadangan: ditanyakan saat dijalankan (atau variabel BACKUP_PASSPHRASE).
 * Kunci proyek dibaca dari .env.local (NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY). Jangan pernah membagikannya.
 * Sifat: GABUNG. Baris dengan id yang sama ditimpa dengan isi cadangan; baris yang tidak ada di cadangan TIDAK dihapus.
 */
import { readFileSync, existsSync } from "node:fs";
import { createDecipheriv, scryptSync, pbkdf2Sync } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { createInterface } from "node:readline";

const MAGIC_V1 = Buffer.from("PSABK1\n", "utf8"); // kunci scrypt (cadangan lama)
const MAGIC_V2 = Buffer.from("PSABK2\n", "utf8"); // kunci PBKDF2 (cadangan baru, bisa dibuka di web)
const MAGIC = MAGIC_V2;
const PK = { user_roles: "user_id,role", system_settings: "key" };
const BATCH = 500;

function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

function ask(q, hidden = false) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) { rl._writeToOutput = (s) => { if (s.includes(q)) process.stdout.write(s); }; }
    rl.question(q, (a) => { rl.close(); if (hidden) process.stdout.write("\n"); resolve(a); });
  });
}

function decrypt(path, pass) {
  const buf = readFileSync(path);
  const v1 = buf.subarray(0, MAGIC_V1.length).equals(MAGIC_V1);
  if (buf.length < MAGIC.length + 16 + 12 + 16 || !(v1 || buf.subarray(0, MAGIC.length).equals(MAGIC_V2))) throw new Error("Ini bukan berkas cadangan Pandian Smart Attendance.");
  let o = MAGIC.length;
  const salt = buf.subarray(o, o + 16); o += 16;
  const iv = buf.subarray(o, o + 12); o += 12;
  const tag = buf.subarray(buf.length - 16);
  const body = buf.subarray(o, buf.length - 16);
  const d = createDecipheriv("aes-256-gcm", v1 ? scryptSync(pass, salt, 32) : pbkdf2Sync(pass, salt, 600000, 32, "sha256"), iv);
  d.setAuthTag(tag);
  let plain;
  try { plain = Buffer.concat([d.update(body), d.final()]); }
  catch { throw new Error("Gagal membuka: kata sandi salah, atau berkas rusak/terpotong. Tidak ada yang diubah."); }
  return gunzipSync(plain).toString("utf8");
}

function parse(text) {
  const data = { meta: null, end: null, auth: [], tables: {} };
  for (const line of text.split("\n")) {
    if (!line) continue;
    const o = JSON.parse(line);
    if (o.t === "meta") data.meta = o;
    else if (o.t === "end") data.end = o;
    else if (o.t === "auth") data.auth.push(o.row);
    else (data.tables[o.t] ??= []).push(o.row);
  }
  if (!data.meta) throw new Error("Berkas tidak memiliki bagian meta.");
  if (!data.end) throw new Error("Berkas tidak lengkap (bagian akhir tidak ada). Jangan dipakai.");
  const bad = [];
  for (const t of data.meta.tables) if ((data.tables[t]?.length ?? 0) !== (data.end.counts[t] ?? 0)) bad.push(t);
  if (data.auth.length !== (data.end.counts["auth.users"] ?? 0)) bad.push("auth.users");
  if (bad.length) throw new Error("Jumlah baris tidak cocok pada: " + bad.join(", "));
  return data;
}

function summary(d) {
  console.log(`Dibuat pada : ${d.meta.created_at}`);
  console.log(`Akun login  : ${d.auth.length}`);
  for (const t of d.meta.tables) console.log(`  ${t.padEnd(32)} ${String(d.tables[t]?.length ?? 0).padStart(7)}`);
}

async function main() {
  const [cmd, file, ...flags] = process.argv.slice(2);
  if (!["verify", "restore"].includes(cmd) || !file) {
    console.log("Pemakaian:\n  node scripts/backup/restore.mjs verify  <berkas>\n  node scripts/backup/restore.mjs restore <berkas> [--apply]");
    process.exit(1);
  }
  const apply = flags.includes("--apply");
  const pass = process.env.BACKUP_PASSPHRASE || (await ask("Kata sandi cadangan: ", true));
  const data = parse(decrypt(file, pass));
  console.log("Berkas valid dan lengkap.\n");
  summary(data);
  if (cmd === "verify") return;

  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY tidak ditemukan di .env.local.");
  const host = new URL(url).host;
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  console.log(`\nProyek tujuan: ${host}`);

  const probe = await sb.rpc("restoring");
  if (probe.error) throw new Error("Migrasi 017 belum dijalankan di proyek ini (fungsi restoring tidak ada). Jalankan 017_restore_mode.sql dulu.");

  // Perbandingan (uji coba)
  console.log("\nPerbandingan dengan database tujuan (baris di cadangan / baris di database):");
  for (const t of data.meta.tables) {
    const { count } = await sb.from(t).select("*", { count: "exact", head: true });
    console.log(`  ${t.padEnd(32)} ${String(data.tables[t]?.length ?? 0).padStart(7)} / ${count ?? "?"}`);
  }
  if (!apply) { console.log("\nIni uji coba, tidak ada yang diubah. Tambahkan --apply untuk memulihkan."); return; }

  console.log("\nPERINGATAN: baris dengan id yang sama akan DITIMPA isi cadangan. Baris lain tidak dihapus.");
  const typed = await ask(`Ketik nama proyek tujuan (${host}) untuk melanjutkan: `);
  if (typed.trim() !== host) { console.log("Dibatalkan."); process.exit(1); }

  const errors = [];
  const done = {};
  const begin = await sb.rpc("restore_begin");
  if (begin.error) throw new Error("Gagal menyalakan mode pemulihan: " + begin.error.message);
  try {
    // 1. Akun login
    let made = 0, existed = 0;
    for (const u of data.auth) {
      const got = await sb.auth.admin.getUserById(u.id);
      if (got.data?.user) { existed++; continue; }
      const r = await sb.auth.admin.createUser({ id: u.id, email: u.email, email_confirm: true });
      if (r.error) errors.push(`akun ${u.email}: ${r.error.message}`); else made++;
    }
    console.log(`Akun login: ${made} dibuat ulang, ${existed} sudah ada.`);

    // 2. Jejak audit: hanya bila database tujuan masih kosong (tanpa kolom id agar tidak bentrok)
    const aud = data.tables["audit_logs"] ?? [];
    const { count: ac } = await sb.from("audit_logs").select("*", { count: "exact", head: true });
    if ((ac ?? 0) === 0 && aud.length) {
      for (let i = 0; i < aud.length; i += BATCH) {
        const rows = aud.slice(i, i + BATCH).map(({ id, ...rest }) => rest);
        const r = await sb.from("audit_logs").insert(rows);
        if (r.error) errors.push(`audit_logs: ${r.error.message}`);
      }
      done["audit_logs"] = aud.length;
    } else console.log("Jejak audit dilewati (database tujuan sudah memiliki jejak audit).");

    // 3. Tabel data sesuai urutan ketergantungan
    for (const t of data.meta.tables) {
      if (t === "audit_logs") continue;
      const rows = data.tables[t] ?? [];
      let ok = 0;
      for (let i = 0; i < rows.length; i += BATCH) {
        const chunk = rows.slice(i, i + BATCH);
        const r = await sb.from(t).upsert(chunk, { onConflict: PK[t] ?? "id" });
        if (r.error) errors.push(`${t} (baris ${i + 1}-${i + chunk.length}): ${r.error.message}`); else ok += chunk.length;
      }
      done[t] = ok;
      console.log(`  ${t.padEnd(32)} ${ok}/${rows.length}`);
    }
  } finally {
    await sb.rpc("restore_end");
    await sb.from("audit_logs").insert({ action: "restore_completed", entity_table: "backup", new_data: { source_created_at: data.meta.created_at, restored: done, error_count: errors.length } });
  }
  if (errors.length) {
    console.log(`\nSELESAI DENGAN ${errors.length} MASALAH:`);
    errors.slice(0, 30).forEach((e) => console.log("  - " + e));
    process.exit(2);
  }
  console.log("\nPemulihan selesai tanpa galat. Langkah berikut: minta pengguna memakai 'Lupa kata sandi' atau masuk dengan Google.");
}

main().catch((e) => { console.error("\nGALAT: " + e.message); process.exit(1); });