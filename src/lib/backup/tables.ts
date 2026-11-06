/**
 * Tabel yang dicadangkan, dalam URUTAN KETERGANTUNGAN (induk lebih dulu).
 * Urutan yang sama dipakai skrip pemulihan. pk = kolom kunci untuk penomoran halaman dan upsert.
 * Berkas dokumen izin di Supabase Storage TIDAK termasuk (hanya catatan tabelnya).
 */
export type BackupTable = { name: string; pk: string };

export const BACKUP_TABLES: BackupTable[] = [
  { name: "profiles", pk: "id" },
  { name: "user_roles", pk: "user_id,role" },
  { name: "academic_years", pk: "id" },
  { name: "classes", pk: "id" },
  { name: "students", pk: "id" },
  { name: "parents", pk: "id" },
  { name: "parent_student_links", pk: "id" },
  { name: "student_class_assignments", pk: "id" },
  { name: "student_qr_tokens", pk: "id" },
  { name: "class_homeroom_history", pk: "id" },
  { name: "school_calendar", pk: "id" },
  { name: "system_settings", pk: "key" },
  { name: "dispensations", pk: "id" },
  { name: "dispensation_students", pk: "id" },
  { name: "permission_requests", pk: "id" },
  { name: "permission_request_events", pk: "id" },
  { name: "permission_documents", pk: "id" },
  { name: "attendance_sessions", pk: "id" },
  { name: "attendance_records", pk: "id" },
  { name: "attendance_corrections", pk: "id" },
  { name: "early_dismissal_requests", pk: "id" },
  { name: "early_dismissal_handover_logs", pk: "id" },
  { name: "notifications", pk: "id" },
  { name: "audit_logs", pk: "id" },
];

/** v2: kunci dari PBKDF2-SHA256 (dapat dibuka langsung di peramban). v1 (scrypt) hanya dibaca skrip pemulihan. */
export const BACKUP_MAGIC = "PSABK2\n";
export const PBKDF2_ITERATIONS = 600000;
export const MIN_PASSPHRASE = 12;