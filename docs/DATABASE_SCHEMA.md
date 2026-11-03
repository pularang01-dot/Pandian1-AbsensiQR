# Skema Basis Data

Sumber kebenaran: `supabase/migrations/001_schema.sql` dan seterusnya. Dokumen ini ringkasan.

## Urutan migrasi

001 skema, 002 fungsi/RPC/pemicu, 003 RLS dan hak akses, 004 storage privat, 005 fungsi laporan (SECURITY INVOKER), 006 penempatan kelas dan impor siswa, 007 dispensasi atomik dan notifikasi pulang awal, 008 tahun ajaran atomik. Terapkan berurutan.

## Tabel (24)

Identitas: profiles (1-1 dengan auth.users), user_roles, parents, parent_student_links.
Akademik: academic_years (satu aktif, indeks unik parsial), classes, students (is_demo), student_class_assignments (satu penempatan terbuka per siswa per tahun), student_qr_tokens (satu aktif per siswa).
Kalender/pengaturan: school_calendar (holiday, special_activity, extra_school_day), system_settings (nilai non-rahasia).
Absensi: attendance_sessions (unik per tanggal), attendance_records (unik per sesi dan siswa), attendance_corrections.
Izin: permission_requests, permission_documents, permission_request_events.
Dispensasi: dispensations, dispensation_students (participation, needs_review).
Pulang awal: early_dismissal_requests, early_dismissal_handover_logs (serah terima berhasil unik per permintaan).
Lainnya: notifications, audit_logs.

## Enum

app_role, student_status, attendance_status (present, late, sick, permission, official_activity, unexcused, unverified), attendance_source (qr, manual, permission, dispensation, system), request_status, permission_category (sick, permission), dispensation_status, participation_status, dismissal_status, handover_outcome (handed_over, verification_failed), calendar_kind.

## Pengaman data

- RLS aktif pada semua tabel (tanpa FORCE); anon tidak punya hak apa pun.
- Hak tulis langsung dicabut untuk tabel sensitif; hanya RPC SECURITY DEFINER dengan `set search_path = public`.
- Fungsi internal dicabut dari authenticated. Fungsi baru wajib `revoke execute ... from public, anon` (default privileges sudah dicabut).
- Audit: pemicu pada tabel utama menulis ke audit_logs (aksi, data lama/baru, aktor). Perubahan absensi dan koreksi memiliki jejak sendiri.
- Constraint: cek panjang teks, rentang tanggal, status siswa aktif untuk operasi tertentu.

## Fungsi laporan

attendance_summary, student_attendance_summary, active_students_by_class: SECURITY INVOKER sehingga hasil otomatis dibatasi RLS pemanggil (guru hanya kelasnya).
