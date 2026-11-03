# Arsitektur Sistem

## Gambaran

Aplikasi Next.js 15 (App Router) dengan komponen server dan Server Actions. Supabase menyediakan PostgreSQL, Auth, dan Storage privat. Tidak ada server aplikasi terpisah.

```
Peramban  ->  Next.js (middleware, server components, server actions, route handlers)
                  |  klien Supabase atas nama pengguna (anon key + sesi)  -> RLS berlaku
                  |  klien service-role (hanya server, hanya Pengaturan > Pengguna) -> melewati RLS
                  v
            Supabase: PostgreSQL (RLS, fungsi SECURITY DEFINER), Auth, Storage privat
```

## Lapisan otorisasi (berlapis)

1. Middleware menyegarkan sesi dengan `getUser()` (validasi ke server Auth) dan mengalihkan yang belum masuk ke /login. Jalur publik: /login, /forgot-password, /reset-password, /auth.
2. `requireRole(...)` pada setiap halaman dan Server Action. Peta `ROUTE_ACCESS` hanya gerbang navigasi.
3. RLS pada 23 tabel: sumber kebenaran akses data.
4. Fungsi basis data SECURITY DEFINER memeriksa peran lagi di dalam transaksi.

## Prinsip penulisan data

Klien tidak boleh menulis langsung ke attendance_records, attendance_corrections, attendance_sessions, student_qr_tokens, audit_logs, handover logs, dan permission_request_events (hak dicabut). Semua tulis lewat RPC atomik dan teraudit: `record_attendance`, `correct_attendance`, `reconcile_attendance`, `regenerate_qr_token`, `review_permission`, `create_dispensation`, `review_dispensation`, `confirm_participation`, `complete_dispensation`, `review_dismissal`, `complete_handover`, `assign_student_class`, `import_students`, `activate/archive_academic_year`.

## Alur utama

- Absensi QR: `lookup_qr_token` (tanpa tulis) -> operator memeriksa nama/foto secara visual -> `record_attendance`. QR hanya memuat token acak 48 heksa; bukan bukti kehadiran fisik dan tidak pernah mengizinkan pemulangan.
- Izin: orang tua mengajukan -> `review_permission` (start_review, request_clarification, reject, approve, cancel_approval). Persetujuan menerapkan status per hari sekolah tanpa menimpa Hadir/Terlambat. Pengajuan retroaktif ditandai otomatis (trigger) dan wajib catatan peninjauan.
- Dispensasi: terpisah dari sakit/izin. Persetujuan bukan bukti ikut serta; absensi Kegiatan Resmi dicatat hanya saat guru pendamping mengonfirmasi.
- Pulang awal: persetujuan memerlukan verifikasi pemohon; serah terima dicatat terpisah dan hanya sah bila identitas penjemput cocok.

## Perhitungan kehadiran

Satu sumber: `src/lib/attendance-calc.ts`. Kehadiran fisik = Hadir + Terlambat. Persentase = fisik / (siswa - Kegiatan Resmi). Bernilai kosong bila penyebut nol. Dipakai dashboard, laporan, dan ekspor.

## Waktu

Zona waktu sekolah dari pengaturan (default Asia/Jakarta, WIB). Input datetime-local ditafsirkan sebagai WIB. "Hari ini" dihitung di basis data (`school_today()`), bukan dari jam peramban.

## Struktur direktori

```
src/app            rute (login, (app)/..., parent/..., settings/..., reports/..., auth/callback)
src/components     ui, layout, auth, charts, students, attendance, permissions, dispensations, dismissal, reports, settings
src/lib            auth, supabase (client/server/admin/middleware), validation (zod), data (loader server), attendance-calc, export-safe
supabase/migrations 001-008   supabase/tests   supabase/seed (demo)
docs
```
