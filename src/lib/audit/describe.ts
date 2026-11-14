/** Mengubah baris audit_logs menjadi kalimat Indonesia yang mudah dibaca. Murni (tanpa akses data) agar mudah diuji. */

export type AuditRow = {
  id: number;
  actor_id: string | null;
  action: string;
  entity_table: string;
  entity_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  reason: string | null;
  created_at: string;
};
export type NameMap = Record<string, string>;

export type CategoryKey = "all" | "akun" | "siswa" | "absensi" | "izin" | "pengaturan" | "data";
export const CATEGORIES: { key: CategoryKey; label: string; tables: string[]; actions: string[] }[] = [
  { key: "all", label: "Semua administrasi", tables: [], actions: [] },
  { key: "akun", label: "Akun dan peran", tables: ["profiles", "user_roles", "user_admin"], actions: ["create_user", "delete_user", "activate_user", "deactivate_user", "set_roles", "link_student", "resend_invite", "deactivate_orphan_parents", "account_hygiene_run", "account_hygiene_now"] },
  { key: "siswa", label: "Siswa dan kelas", tables: ["students", "classes", "academic_years", "student_class_assignments", "parent_student_links", "student_qr_tokens", "class_homeroom_history"], actions: ["import_students", "assign_students_class", "delete_students", "manual_delete_students", "graduate_class", "promote_students"] },
  { key: "absensi", label: "Absensi", tables: ["attendance_records", "attendance_sessions", "attendance_corrections"], actions: ["class_attendance", "class_attendance_backdated", "correct_attendance", "reconcile"] },
  { key: "izin", label: "Izin, dispensasi, pulang awal", tables: ["permission_requests", "dispensations", "dispensation_students", "early_dismissal_requests", "early_dismissal_handover_logs"], actions: ["permission_approve", "permission_reject", "confirm_participation"] },
  { key: "pengaturan", label: "Pengaturan sekolah", tables: ["system_settings", "school_calendar"], actions: [] },
  { key: "data", label: "Cadangan dan pemulihan", tables: ["backup"], actions: ["backup_started", "backup_completed", "restore_completed"] },
];

/** Perubahan rutin berfrekuensi tinggi yang disembunyikan secara bawaan. */
export const NOISE_TABLES = ["attendance_records", "notifications"];

const TABLE_NOUN: Record<string, string> = {
  students: "data siswa", classes: "kelas", profiles: "profil pengguna", user_roles: "peran pengguna", academic_years: "tahun ajaran",
  student_class_assignments: "penempatan kelas", parent_student_links: "tautan orang tua", student_qr_tokens: "kartu QR siswa",
  school_calendar: "kalender sekolah", system_settings: "pengaturan", permission_requests: "pengajuan izin", dispensations: "dispensasi",
  dispensation_students: "peserta dispensasi", early_dismissal_requests: "izin pulang awal", early_dismissal_handover_logs: "catatan penjemputan",
  attendance_records: "catatan absensi", attendance_sessions: "sesi absensi", attendance_corrections: "koreksi absensi", class_homeroom_history: "riwayat wali kelas",
};

const FIELD: Record<string, string> = {
  nis: "NIS", nisn: "NISN", full_name: "Nama lengkap", gender: "Jenis kelamin", status: "Status", is_demo: "Data contoh (demo)",
  academic_year_id: "Tahun ajaran", name: "Nama", grade_level: "Tingkat kelas", homeroom_teacher_id: "Wali kelas", is_active: "Aktif",
  start_date: "Tanggal mulai", end_date: "Tanggal selesai", is_archived: "Diarsipkan", student_id: "Siswa", class_id: "Kelas",
  requested_by: "Diajukan oleh", entered_manually: "Dicatat langsung oleh sekolah", category: "Jenis", reason: "Alasan",
  is_retrospective: "Izin susulan (setelah kejadian)", review_note: "Catatan peninjau", reviewed_by: "Ditinjau oleh", reviewed_at: "Waktu ditinjau",
  submitted_at: "Waktu diajukan", location: "Lokasi", description: "Keterangan", starts_at: "Mulai", ends_at: "Selesai", supervisor_id: "Pembimbing",
  requester_relation: "Hubungan pengaju dengan siswa", requested_time: "Jam pulang yang diminta", authorized_pickup_name: "Nama penjemput",
  authorized_pickup_relation: "Hubungan penjemput", requester_verified: "Identitas pengaju terverifikasi", requester_verification_note: "Catatan verifikasi",
  calendar_date: "Tanggal", kind: "Jenis hari", phone: "Nomor telepon", role: "Peran", user_id: "Pengguna", granted_by: "Diberikan oleh",
  relationship: "Hubungan dengan siswa", key: "Pengaturan", value: "Nilai", note: "Catatan", source: "Sumber", checked_in_at: "Waktu hadir",
  recorded_by: "Dicatat oleh", created_by: "Dibuat oleh", revoked_at: "Dicabut pada", revoked_by: "Dicabut oleh", decision_note: "Catatan keputusan",
  title: "Judul", email: "Email", inserted: "Jumlah tersimpan", orphan_parents: "Akun orang tua tanpa anak aktif", stale_accounts: "Akun lama tidak dipakai",
  from: "Sebelumnya", to: "Menjadi", homeroom_cleared: "Wali kelas dikosongkan", orphan_days: "Batas hari akun orang tua tanpa anak aktif", stale_days: "Batas hari akun tidak dipakai",
};
/** Kolom teknis yang tidak berguna bagi manusia. */
const HIDDEN = new Set(["id", "session_id", "permission_request_id", "dispensation_id", "parent_id", "profile_id", "created_at", "updated_at", "outcome_id", "request_id"]);
const IGNORED = new Set(["updated_at", "created_at"]);
const SECRET = /token|password|secret|hash|service_role|api_key/i;
const PEOPLE_KEYS = ["user_id", "teacher_id", "homeroom_teacher_id", "reviewed_by", "granted_by", "requested_by", "supervisor_id", "recorded_by", "created_by", "revoked_by"];

const VALUE: Record<string, string> = {
  active: "Aktif", inactive: "Nonaktif", graduated: "Lulus", transferred: "Pindah sekolah", pending: "Menunggu", under_review: "Sedang ditinjau",
  needs_clarification: "Perlu klarifikasi", approved: "Disetujui", rejected: "Ditolak", cancelled: "Dibatalkan", completed: "Selesai",
  present: "Hadir", late: "Terlambat", sick: "Sakit", permission: "Izin", unexcused: "Alpa", official_activity: "Kegiatan resmi", unverified: "Belum terverifikasi",
  unconfirmed: "Belum dikonfirmasi", participated: "Ikut serta", not_participated: "Tidak ikut serta",
  qr: "Pemindaian QR", manual: "Dicatat manual", dispensation: "Dispensasi", system: "Sistem",
  holiday: "Hari libur", special_activity: "Kegiatan khusus", extra_school_day: "Hari sekolah tambahan",
  handed_over: "Diserahkan", verification_failed: "Verifikasi gagal",
  super_admin: "Super admin", school_admin: "Admin sekolah", principal: "Kepala sekolah", teacher: "Guru", operator: "Operator", parent: "Orang tua",
  L: "Laki-laki", P: "Perempuan",
};
const SETTING_LABEL: Record<string, string> = {
  "school.name": "Nama sekolah", "school.address": "Alamat sekolah", "school.phone": "Telepon sekolah", "school.timezone": "Zona waktu sekolah",
  "attendance.start_time": "Jam mulai absensi", "attendance.late_after": "Batas jam terlambat", "attendance.go_live_date": "Tanggal mulai dipakai", "attendance.close_time": "Jam penutupan absensi",
  "attendance.school_days": "Hari sekolah", "hygiene.orphan_parent_days": "Batas hari akun orang tua tanpa anak aktif",
  "hygiene.stale_account_days": "Batas hari akun tidak dipakai", "permission.document_required_for_sick_days": "Sakit yang wajib dilengkapi surat (hari)",
};
const HARI = ["", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WALL = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

const fieldLabel = (k: string) => FIELD[k] ?? k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

/** Mengubah nilai teknis menjadi kalimat/angka yang dipahami manusia (nama, tanggal Indonesia, Ya/Tidak, dst.). */
function human(key: string, v: unknown, n: Names, table = ""): string {
  if (v === null || v === undefined || v === "") return "(kosong)";
  if (SECRET.test(key)) return "(disembunyikan)";
  if (typeof v === "boolean") return v ? "Ya" : "Tidak";
  if (table === "system_settings" && key === "value") return v === null ? "(kosong)" : "";
  if (Array.isArray(v)) return v.length === 0 ? "(kosong)" : v.map((x) => human(key, x, n, table)).join(", ");
  if (typeof v === "object") return "(rincian teknis)";
  const sv = String(v);
  if (UUID.test(sv)) {
    if (key === "student_id") return n.students[sv] ?? "(siswa tidak dikenal)";
    if (key === "class_id") return n.classes[sv] ?? "(kelas tidak dikenal)";
    if (key === "academic_year_id") return n.years[sv] ?? "(tahun ajaran tidak dikenal)";
    return n.people[sv] ?? "(tidak dikenal)";
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(sv)) { const [y, m, d] = sv.split("-").map(Number); return `${d} ${BULAN[m - 1]} ${y}`; }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(sv)) {
    const dt = new Date(sv);
    if (!Number.isNaN(dt.getTime())) {
      const p = Object.fromEntries(WALL.formatToParts(dt).map((x) => [x.type, x.value]));
      return `${Number(p.day)} ${BULAN[Number(p.month) - 1]} ${p.year} pukul ${p.hour}.${p.minute} WIB`;
    }
  }
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(sv)) return `${sv.slice(0, 2)}.${sv.slice(3, 5)}`;
  return VALUE[sv] ?? sv;
}

/** Nilai pengaturan sekolah (kolom value) menurut kunci pengaturannya. */
function settingValue(key: string, v: unknown, n: Names): string {
  if (key === "attendance.school_days" && Array.isArray(v)) return v.map((d) => HARI[Number(d)] ?? String(d)).join(", ");
  if (typeof v === "number") return String(v);
  return human("setting", v, n);
}

const CUSTOM: Record<string, string> = {
  class_attendance: "Mencatat absensi kelas", assign_students_class: "Menempatkan siswa ke kelas lewat berkas", class_attendance_backdated: "Mencatat absensi susulan (tanggal lampau)", correct_attendance: "Mengoreksi absensi", reconcile: "Rekonsiliasi absensi",
  confirm_participation: "Mengonfirmasi partisipasi dispensasi", permission_approve: "Menyetujui pengajuan izin", permission_reject: "Menolak pengajuan izin",
  import_students: "Mengimpor data siswa", delete_students: "Menghapus data siswa", manual_delete_students: "Menghapus siswa demo (jalur pemilik)",
  graduate_class: "Meluluskan siswa satu kelas", promote_students: "Memproses kenaikan kelas",
  create_user: "Membuat akun pengguna", delete_user: "Menghapus akun pengguna", activate_user: "Mengaktifkan akun", deactivate_user: "Menonaktifkan akun",
  set_roles: "Mengubah peran pengguna", link_student: "Menautkan orang tua dengan siswa", resend_invite: "Mengirim ulang undangan",
  deactivate_orphan_parents: "Menonaktifkan akun orang tua tanpa anak aktif", account_hygiene_run: "Penonaktifan akun otomatis (terjadwal)",
  account_hygiene_now: "Penonaktifan akun dijalankan manual", backup_started: "Mulai membuat cadangan data", backup_completed: "Selesai membuat cadangan data",
  restore_completed: "Memulihkan data dari cadangan",
};

/** Tindakan berdampak besar: diberi label teks "Penting" (tidak hanya warna). */
const IMPORTANT = new Set(["delete", "delete_students", "manual_delete_students", "delete_user", "graduate_class", "promote_students", "restore_completed", "deactivate_orphan_parents", "set_roles", "account_hygiene_run", "account_hygiene_now"]);
export const isImportant = (r: AuditRow) => IMPORTANT.has(r.action) || (r.action === "update" && r.entity_table === "students" && r.new_data?.status !== r.old_data?.status);

const shorten = (s: string, n = 160) => (s.length > n ? `${s.slice(0, n)}...` : s);

/** ID yang perlu dicari namanya (pelaku, siswa, kelas, pengguna). */
export function collectIds(rows: AuditRow[]) {
  const out = { people: new Set<string>(), students: new Set<string>(), classes: new Set<string>(), years: new Set<string>() };
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  for (const r of rows) {
    if (r.actor_id) out.people.add(r.actor_id);
    if (r.entity_table === "user_admin" && r.entity_id && uuid.test(r.entity_id)) out.people.add(r.entity_id);
    for (const d of [r.new_data, r.old_data]) {
      if (!d) continue;
      for (const k of PEOPLE_KEYS) if (typeof d[k] === "string" && uuid.test(d[k] as string)) out.people.add(d[k] as string);
      if (typeof d.student_id === "string") out.students.add(d.student_id);
      if (typeof d.class_id === "string") out.classes.add(d.class_id);
      if (typeof d.academic_year_id === "string") out.years.add(d.academic_year_id);
      if (typeof d.id === "string" && r.entity_table === "students") out.students.add(d.id);
    }
  }
  return out;
}

export type Names = { people: NameMap; students: NameMap; classes: NameMap; years: NameMap };

function subject(r: AuditRow, n: Names): string {
  const d = r.new_data ?? r.old_data ?? {};
  const s = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : "");
  switch (r.entity_table) {
    case "students": return s("full_name") ? `${s("full_name")}${s("nis") ? ` (NIS ${s("nis")})` : ""}` : "";
    case "classes": case "academic_years": return s("name");
    case "profiles": return s("full_name") || n.people[r.entity_id ?? ""] || "";
    case "user_roles": return `${n.people[s("user_id")] ?? "pengguna"}${s("role") ? ` (${VALUE[s("role")] ?? s("role")})` : ""}`;
    case "system_settings": return SETTING_LABEL[s("key")] ?? s("key") ?? "";
    case "school_calendar": return [s("calendar_date") ? human("calendar_date", s("calendar_date"), n) : "", s("description")].filter(Boolean).join(" - ");
    case "dispensations": return s("name");
    case "student_class_assignments": return `${n.students[s("student_id")] ?? "siswa"}${s("class_id") ? `, kelas ${n.classes[s("class_id")] ?? ""}` : ""}`.trim();
    case "parent_student_links": return n.students[s("student_id")] ? `anak ${n.students[s("student_id")]}` : "";
    case "user_admin": return n.people[r.entity_id ?? ""] ?? "";
    default: return n.students[s("student_id")] ?? "";
  }
}

export type Described = { title: string; detail: string | null; changes: { field: string; before: string; after: string }[]; important: boolean };

function changedFields(r: AuditRow, n: Names): Described["changes"] {
  const out: Described["changes"] = [];
  const keys = new Set([...Object.keys(r.new_data ?? {}), ...Object.keys(r.old_data ?? {})]);
  const isSetting = r.entity_table === "system_settings";
  const key = isSetting ? String((r.new_data ?? r.old_data)?.key ?? "") : "";
  for (const k of keys) {
    if (IGNORED.has(k) || HIDDEN.has(k)) continue;
    const a = r.old_data?.[k], b = r.new_data?.[k];
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    const fmt = (v: unknown) => shorten(isSetting && k === "value" ? settingValue(key, v, n) : human(k, v, n, r.entity_table));
    out.push({ field: fieldLabel(k), before: fmt(a), after: fmt(b) });
  }
  return out;
}

export function describe(r: AuditRow, n: Names): Described {
  const who = subject(r, n);
  const noun = TABLE_NOUN[r.entity_table] ?? r.entity_table.replace(/_/g, " ");
  let changes: Described["changes"] = [];
  let title: string;
  let detail: string | null = null;

  if (CUSTOM[r.action] || r.action.startsWith("account_hygiene")) {
    title = CUSTOM[r.action] ?? "Penonaktifan akun otomatis";
    if (who) title += `: ${who}`;
    const nd = r.new_data ?? {};
    const bits: string[] = [];
    for (const [k, label] of [["inserted", "tersimpan"], ["deactivated", "dinonaktifkan"], ["graduated", "diluluskan"], ["promoted", "dinaikkan"], ["deleted", "dihapus"], ["marked", "ditandai"]] as const) {
      if (typeof nd[k] === "number") bits.push(`${nd[k]} siswa ${label}`);
    }
    if (typeof nd.orphan_parents === "number") bits.push(`${nd.orphan_parents} akun orang tua tanpa anak aktif`);
    if (typeof nd.stale_accounts === "number") bits.push(`${nd.stale_accounts} akun lama tidak dipakai`);
    if (Array.isArray(nd.from) && Array.isArray(nd.to)) bits.push(`peran berubah dari ${human("role", nd.from, n) === "(kosong)" ? "tanpa peran" : human("role", nd.from, n)} menjadi ${human("role", nd.to, n) === "(kosong)" ? "tanpa peran" : human("role", nd.to, n)}`);
    if (bits.length) detail = bits.join("; ");
  } else if (r.action === "insert") {
    title = `Menambahkan ${noun}${who ? `: ${who}` : ""}`;
  } else if (r.action === "delete") {
    title = `Menghapus ${noun}${who ? `: ${who}` : ""}`;
  } else if (r.action === "update") {
    changes = changedFields(r, n);
    title = `Mengubah ${noun}${who ? `: ${who}` : ""}`;
    if (changes.length === 0) detail = "Tidak ada perubahan isi.";
    else if (changes.length === 1) detail = `${changes[0].field}: ${changes[0].before} menjadi ${changes[0].after}`;
    else detail = `Yang diubah: ${changes.map((c) => c.field.toLowerCase()).join(", ")}`;
  } else {
    title = `${noun[0].toUpperCase()}${noun.slice(1)}: ${r.action.replace(/_/g, " ")}`;
    if (who) title += ` (${who})`;
  }
  if (r.reason) detail = detail ? `${detail}. Alasan: ${r.reason}` : `Alasan: ${r.reason}`;
  return { title, detail, changes, important: isImportant(r) };
}

/** Isi data mentah dalam bahasa manusia: [label, nilai]. Kolom teknis dan rahasia tidak ditampilkan. */
export function safeData(r: AuditRow, n: Names): [string, string][] {
  const d = r.new_data ?? r.old_data;
  if (!d) return [];
  const isSetting = r.entity_table === "system_settings";
  const key = isSetting ? String(d.key ?? "") : "";
  return Object.entries(d)
    .filter(([k]) => !IGNORED.has(k) && !HIDDEN.has(k) && !(isSetting && k === "key") && !SECRET.test(k))
    .map(([k, v]): [string, string] => [fieldLabel(k), shorten(isSetting && k === "value" ? settingValue(key, v, n) : human(k, v, n, r.entity_table))]);
}