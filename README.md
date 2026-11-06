# PANDIAN SMART ATTENDANCE

Sistem absensi, izin, dispensasi, pulang lebih awal, dan pelaporan untuk SDN Pandian 1 Sumenep.

Teknologi: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Supabase (PostgreSQL, Auth, RLS, Storage privat), Zod, React Hook Form, zxing (pemindai QR), recharts, jsPDF dan xlsx (ekspor).

> Status verifikasi yang jujur: migrasi basis data dan aturan perilaku (RLS, RPC) sudah diuji pada PostgreSQL 16 lokal dengan stub Supabase (191 pemeriksaan lulus). Kode aplikasi baru melewati pemeriksaan sintaks dan impor. `npm run build`, `lint`, `typecheck`, dan pengujian peramban BELUM dijalankan karena dependensi belum dipasang. Lihat docs/TESTING_CHECKLIST.md dan jalankan sebelum dipakai.

## Modul

Absensi QR (dua langkah, konfirmasi visual operator), absensi manual dan koreksi dengan jejak audit, rekonsiliasi, siswa dan kelas (impor, ekspor, kartu QR), izin dan sakit (dokumen privat), dispensasi kegiatan resmi, pulang lebih awal (serah terima terpisah dari persetujuan), laporan harian/bulanan/per siswa (Excel, CSV, PDF, cetak), portal orang tua, notifikasi, pengaturan (sekolah, aturan absensi, tahun ajaran, kalender, pengguna, peran).

## Prasyarat

Node.js 20 atau lebih baru, akun Supabase (proyek baru), Supabase CLI opsional.

## Pemasangan (manual)

Dependensi TIDAK dipasang otomatis. Jalankan sendiri di folder proyek:

```bash
npm install
```

(Seluruh dependensi sudah tercantum di package.json: @hookform/resolvers, @supabase/ssr, @supabase/supabase-js, @zxing/browser, @zxing/library, clsx, date-fns, jspdf, jspdf-autotable, lucide-react, next, qrcode, react, react-dom, react-hook-form, recharts, server-only, sonner, tailwind-merge, xlsx, zod, serta paket dev TypeScript/Tailwind/ESLint.)

## Menyiapkan Supabase

1. Buat proyek di https://supabase.com. Catat Project URL, anon key, dan service-role key (Project Settings > API).
2. Buka SQL Editor, jalankan berkas berikut BERURUTAN, satu per satu, dan pastikan tiap berkas selesai tanpa galat:
   `supabase/migrations/001_schema.sql` sampai `017_restore_mode.sql`.
   (Atau dengan CLI: `supabase db push` pada proyek yang sudah di-link.)
3. Authentication > Providers: aktifkan Email. Nonaktifkan pendaftaran mandiri (Sign ups) agar akun hanya dibuat administrator.
4. Authentication > URL Configuration: Site URL = alamat aplikasi; tambahkan `<alamat>/auth/callback` ke Redirect URLs.
5. Authentication > Email Templates: agar tautan undangan dan pemulihan bekerja di server, ubah tautan templat Invite dan Reset Password menjadi
   `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=invite&next=/reset-password`
   dan `...&type=recovery&next=/reset-password`.
6. Atur SMTP sendiri untuk pemakaian nyata; layanan email bawaan Supabase sangat dibatasi. Panduan Brevo langkah demi langkah: docs/EMAIL_SETUP_BREVO.md. Login Google untuk staf (opsional): docs/GOOGLE_LOGIN_SETUP.md.
7. Storage: bucket privat `permission-documents` dibuat oleh migrasi 004. Jangan dijadikan publik.

## Variabel lingkungan

Salin `.env.example` menjadi `.env.local` dan isi:

| Variabel | Keterangan |
| --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | URL proyek |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Kunci anon (publik) |
| SUPABASE_SERVICE_ROLE_KEY | Rahasia. Hanya server. Jangan diawali NEXT_PUBLIC_ dan jangan di-commit |
| NEXT_PUBLIC_APP_URL | Alamat aplikasi, untuk tautan email dan login Google |
| NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED | `true` untuk menampilkan tombol Masuk dengan Google (setelah provider diaktifkan) |

## Administrator awal (aman, tanpa akun bawaan)

Tidak ada akun atau kata sandi bawaan.

1. Supabase > Authentication > Users > Add user: buat akun dengan email milik sekolah (kata sandi kuat, unik).
2. Di SQL Editor jalankan: `select public.bootstrap_super_admin('email-anda@contoh.sch.id');`
   Fungsi ini hanya berhasil SELAMA belum ada Super Admin, dan tidak dapat dipanggil dari aplikasi atau API.
3. Masuk ke aplikasi, lalu isi Pengaturan > Identitas sekolah, Aturan absensi, Tahun ajaran, dan Kalender sekolah.
4. Buat pengguna lain dari Pengaturan > Pengguna (undangan email; admin tidak menetapkan kata sandi). Banyak guru/wali kelas/staf sekaligus: Pengaturan > Pengguna > Impor staf (CSV/Excel, maks 50 baris per unggahan). Undangan yang tidak sampai dapat dikirim ulang dari daftar Pengguna.

## Menjalankan

```bash
npm run dev      # pengembangan, http://localhost:3000
npm run build    # produksi
npm run start
```

## Data demo (opsional)

`supabase/seed/demo_seed.sql` membuat siswa fiktif "Demo Siswa" bertanda `is_demo`. Jangan dijalankan di produksi. Hapus dengan `demo_cleanup.sql`.

## Menjalankan uji basis data lokal

Perlu PostgreSQL 16 lokal: `bash supabase/tests/run_local.sh`. Skrip membuat klaster sementara dengan stub skema auth/storage Supabase, menerapkan migrasi, dan menjalankan `behavior_test.sql`. Ini BUKAN pengganti uji pada Supabase asli.

## Dokumentasi

docs/EMAIL_SETUP_BREVO.md, docs/GOOGLE_LOGIN_SETUP.md, docs/SYSTEM_ARCHITECTURE.md, DATABASE_SCHEMA.md, ROLE_PERMISSIONS.md, ATTENDANCE_SOP.md, PERMISSION_SOP.md, DISPENSATION_SOP.md, EARLY_DISMISSAL_SOP.md, SECURITY_AND_PRIVACY.md, HANDOVER_GUIDE.md, TESTING_CHECKLIST.md.

## Keterbatasan yang diketahui

Pemindai QR tidak memiliki antrean offline (sengaja: kegagalan ditampilkan jelas, tidak ada data semu). Notifikasi hanya di dalam aplikasi (tanpa WhatsApp/SMS/push). Tidak ada ekspor kartu QR massal ke PDF selain cetak peramban. Pengujian peramban dan beban belum dilakukan.

## Hak cipta

Hak Cipta (c) 2026 Viky Aditama. Dikembangkan oleh Viky Aditama bersama Tim PPL SDN Pandian 1 Sumenep, Universitas PGRI Sumenep 2026. Seluruh hak dilindungi. Ketentuan penggunaan ada di [LICENSE.md](LICENSE.md). Teks hak cipta pada aplikasi diatur di `src/lib/copyright.ts`.

## Pencadangan dan pemulihan
Super admin membuat cadangan terenkripsi di Pengaturan > Pencadangan data. Pemeriksaan dan pemulihan lewat `scripts/backup/restore.mjs`. Panduan lengkap: docs/BACKUP_RESTORE_SOP.md.

## Penjaga proyek tidak tertidur
`vercel.json` menjadwalkan panggilan harian ke `/api/keepalive`. Atur environment variable `CRON_SECRET` (teks acak minimal 32 karakter) di Vercel, lalu deploy ulang. Tanpa itu endpoint menjawab 503 dan penjaga tidak bekerja.