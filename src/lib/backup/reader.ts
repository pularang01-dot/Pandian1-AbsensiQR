/**
 * Pembaca cadangan (.psabak v2) yang berjalan LANGSUNG DI PERAMBAN: berkas tidak diunggah ke server mana pun.
 * Tanpa impor agar dapat diuji di Node. Memakai WebCrypto (PBKDF2 + AES-GCM) dan DecompressionStream.
 */
export type Row = Record<string, unknown>;
export type BackupData = {
  meta: { created_at: string; tables: string[] };
  counts: Record<string, number>;
  auth: Row[];
  tables: Record<string, Row[]>;
};

const MAGIC = "PSABK2\n";
const ITER = 600000;

export class BackupError extends Error {}

export async function openBackup(file: ArrayBuffer, passphrase: string): Promise<BackupData> {
  const buf = new Uint8Array(file);
  const head = new TextDecoder().decode(buf.subarray(0, MAGIC.length));
  if (head === "PSABK1\n") throw new BackupError("Berkas ini dibuat dengan format lama. Buat cadangan baru dari halaman ini, atau periksa memakai skrip pemulihan.");
  if (buf.length < MAGIC.length + 16 + 12 + 16 || head !== MAGIC) throw new BackupError("Ini bukan berkas cadangan Pandian Smart Attendance.");
  const salt = buf.subarray(MAGIC.length, MAGIC.length + 16);
  const iv = buf.subarray(MAGIC.length + 16, MAGIC.length + 28);
  const sealed = buf.subarray(MAGIC.length + 28); // ciphertext + tag 16 byte (susunan yang dipakai WebCrypto)
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: ITER, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  let gz: ArrayBuffer;
  try { gz = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, sealed); }
  catch { throw new BackupError("Gagal membuka: kata sandi salah, atau berkas rusak atau terpotong."); }
  const text = await new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream("gzip"))).text();

  let meta: BackupData["meta"] | null = null;
  let end: { counts: Record<string, number> } | null = null;
  const auth: Row[] = [];
  const tables: Record<string, Row[]> = {};
  for (const line of text.split("\n")) {
    if (!line) continue;
    const o = JSON.parse(line) as { t: string; row?: Row } & Record<string, unknown>;
    if (o.t === "meta") meta = o as unknown as BackupData["meta"];
    else if (o.t === "end") end = o as unknown as { counts: Record<string, number> };
    else if (o.t === "auth") auth.push(o.row as Row);
    else (tables[o.t] ??= []).push(o.row as Row);
  }
  if (!meta) throw new BackupError("Berkas tidak memiliki bagian awal.");
  if (!end) throw new BackupError("Berkas tidak lengkap. Jangan dipakai.");
  const bad: string[] = [];
  for (const t of meta.tables) if ((tables[t]?.length ?? 0) !== (end.counts[t] ?? 0)) bad.push(t);
  if (auth.length !== (end.counts["auth.users"] ?? 0)) bad.push("auth.users");
  if (bad.length) throw new BackupError("Jumlah baris tidak cocok pada: " + bad.join(", "));
  return { meta, counts: end.counts, auth, tables };
}

export const TABLE_LABEL: Record<string, string> = {
  profiles: "Profil pengguna", user_roles: "Peran pengguna", academic_years: "Tahun ajaran", classes: "Kelas", students: "Siswa",
  parents: "Orang tua", parent_student_links: "Tautan orang tua dan siswa", student_class_assignments: "Penempatan kelas",
  student_qr_tokens: "Kartu QR", class_homeroom_history: "Riwayat wali kelas", school_calendar: "Kalender sekolah",
  system_settings: "Pengaturan", dispensations: "Dispensasi", dispensation_students: "Peserta dispensasi",
  permission_requests: "Pengajuan izin", permission_request_events: "Riwayat pengajuan izin", permission_documents: "Catatan dokumen izin",
  attendance_sessions: "Sesi absensi", attendance_records: "Catatan absensi", attendance_corrections: "Koreksi absensi",
  early_dismissal_requests: "Izin pulang awal", early_dismissal_handover_logs: "Catatan penjemputan", notifications: "Notifikasi", audit_logs: "Jejak audit",
};

type Cell = string | number;
export type Sheets = { name: string; rows: Cell[][] }[];

const s = (v: unknown): string => (v === null || v === undefined ? "" : String(v));

/**
 * Lembar Excel yang terbaca manusia. Sengaja TIDAK memuat alasan izin, token QR, email, atau jejak audit
 * agar berkas Excel yang mudah disalin tidak membawa data yang lebih sensitif dari yang diperlukan.
 */
export function buildSheets(d: BackupData): Sheets {
  const t = (n: string) => d.tables[n] ?? [];
  const year = new Map(t("academic_years").map((r) => [s(r.id), s(r.name)]));
  const prof = new Map(t("profiles").map((r) => [s(r.id), s(r.full_name)]));
  const cls = new Map(t("classes").map((r) => [s(r.id), r]));
  const stu = new Map(t("students").map((r) => [s(r.id), r]));
  const ses = new Map(t("attendance_sessions").map((r) => [s(r.id), s(r.session_date)]));

  // Kelas aktif terakhir tiap siswa (penempatan tanpa tanggal akhir; bila tidak ada, yang terbaru).
  const lastClass = new Map<string, string>();
  const assigns = [...t("student_class_assignments")].sort((a, b) => s(a.start_date).localeCompare(s(b.start_date)));
  for (const a of assigns) if (!lastClass.has(s(a.student_id)) || !a.end_date) lastClass.set(s(a.student_id), s(a.class_id));
  const className = (id: string) => s(cls.get(id)?.name);

  const siswa: Cell[][] = [["NIS", "NISN", "Nama", "JK", "Status", "Kelas terakhir", "Data demo"]];
  for (const r of [...t("students")].sort((a, b) => s(a.full_name).localeCompare(s(b.full_name)))) {
    siswa.push([s(r.nis), s(r.nisn), s(r.full_name), s(r.gender), s(r.status), className(lastClass.get(s(r.id)) ?? ""), r.is_demo ? "ya" : ""]);
  }

  const kelas: Cell[][] = [["Tahun ajaran", "Kelas", "Tingkat", "Wali kelas", "Aktif", "Jumlah siswa (penempatan)"]];
  const perClass = new Map<string, number>();
  for (const a of assigns) if (!a.end_date) perClass.set(s(a.class_id), (perClass.get(s(a.class_id)) ?? 0) + 1);
  for (const r of t("classes")) kelas.push([year.get(s(r.academic_year_id)) ?? "", s(r.name), s(r.grade_level), prof.get(s(r.homeroom_teacher_id)) ?? "", r.is_active ? "ya" : "tidak", perClass.get(s(r.id)) ?? 0]);

  const absensi: Cell[][] = [["Tanggal", "Kelas", "NIS", "Nama", "Status", "Sumber", "Catatan"]];
  const statuses = new Set<string>();
  const rekap = new Map<string, Record<string, number>>();
  for (const r of [...t("attendance_records")].sort((a, b) => (ses.get(s(a.session_id)) ?? "").localeCompare(ses.get(s(b.session_id)) ?? ""))) {
    const st = stu.get(s(r.student_id));
    absensi.push([ses.get(s(r.session_id)) ?? "", className(s(r.class_id)), s(st?.nis), s(st?.full_name), s(r.status), s(r.source), s(r.note)]);
    statuses.add(s(r.status));
    const m = rekap.get(s(r.student_id)) ?? {};
    m[s(r.status)] = (m[s(r.status)] ?? 0) + 1;
    rekap.set(s(r.student_id), m);
  }
  const cols = [...statuses].sort();
  const rekapRows: Cell[][] = [["NIS", "Nama", "Kelas terakhir", ...cols, "Total"]];
  for (const [sid, m] of [...rekap].sort((a, b) => s(stu.get(a[0])?.full_name).localeCompare(s(stu.get(b[0])?.full_name)))) {
    const st = stu.get(sid);
    rekapRows.push([s(st?.nis), s(st?.full_name), className(lastClass.get(sid) ?? ""), ...cols.map((c) => m[c] ?? 0), Object.values(m).reduce((x, y) => x + y, 0)]);
  }

  const izin: Cell[][] = [["NIS", "Nama", "Kategori", "Mulai", "Selesai", "Status", "Dicatat sekolah", "Retroaktif"]];
  for (const r of t("permission_requests")) {
    const st = stu.get(s(r.student_id));
    izin.push([s(st?.nis), s(st?.full_name), s(r.category), s(r.start_date), s(r.end_date), s(r.status), r.entered_manually ? "ya" : "", r.is_retrospective ? "ya" : ""]);
  }

  return [
    { name: "Siswa", rows: siswa }, { name: "Kelas", rows: kelas },
    { name: "Rekap absensi", rows: rekapRows }, { name: "Absensi harian", rows: absensi }, { name: "Izin", rows: izin },
  ];
}