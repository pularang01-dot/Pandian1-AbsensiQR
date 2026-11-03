# Keamanan dan Privasi

## Kunci dan rahasia

- SUPABASE_SERVICE_ROLE_KEY hanya dibaca `src/lib/supabase/admin.ts` (`server-only`) dan dipakai hanya di Server Action Pengaturan > Pengguna setelah `requireRole` memverifikasi pemanggil. Tidak pernah dikirim ke peramban.
- Tidak ada akun, kata sandi, atau kunci bawaan. Administrator awal dibuat lewat `bootstrap_super_admin` (hanya berhasil selama belum ada Super Admin; tidak dapat dipanggil dari API).
- Administrator tidak pernah menetapkan kata sandi pengguna; akun baru menerima undangan email.
- Jangan commit `.env.local`. Ganti kunci bila pernah bocor.

## Login Google

Pendaftaran mandiri Supabase harus nonaktif. Callback `/auth/callback` menolak dan menutup sesi akun yang tidak aktif atau tanpa peran. Lihat GOOGLE_LOGIN_SETUP.md.

## Akses data

- RLS pada semua tabel; anon tanpa hak. Guru dibatasi pada kelasnya; orang tua pada anak dengan tautan aktif.
- Tulis sensitif hanya lewat RPC teraudit. Audit log tidak dapat diubah klien.
- Token QR: acak 48 heksa, satu aktif per siswa, dapat dicabut, hanya terbaca administrator. Kode QR hanya memuat token, tanpa data pribadi.
- Dokumen izin: bucket privat, validasi magic-byte (PDF/JPG/PNG), maks 5 MB, nama berkas acak, akses lewat signed URL 60 detik. Gagal unggah membatalkan pengajuan.
- Ekspor: sel teks berawalan = + - @ diberi apostrof (cegah formula injection). Ekspor dibatasi peran dan RLS.
- Header keamanan di next.config.mjs; kamera hanya untuk origin sendiri (pemindai).
- Pencarian disanitasi untuk filter PostgREST. Pesan galat basis data diterjemahkan tanpa membocorkan detail internal.

## Privasi

- Data anak adalah data sensitif. Kumpulkan seperlunya: tidak menyimpan diagnosis medis, nomor identitas penjemput, atau dokumen identitas.
- Alasan sakit cukup keluhan umum. Catatan peninjauan dapat dibaca orang tua; jangan menulis data sensitif lain.
- Nonaktifkan akun yang tidak lagi bertugas. Tinjau daftar pengguna tiap awal tahun ajaran.
- Tentukan masa simpan data dan dasar persetujuan orang tua sesuai kebijakan sekolah dan peraturan perlindungan data pribadi yang berlaku. Ini keputusan sekolah, bukan bawaan sistem.

## Operasional

Aktifkan MFA untuk akun admin di Supabase dan akun pemilik proyek. Aktifkan backup (PITR bila paket mendukung) dan uji pemulihan. Pakai SMTP sendiri. Batasi anggota proyek Supabase. Terapkan HTTPS pada hosting.

## Batasan yang diketahui

Belum ada pembatasan laju (rate limit) tingkat aplikasi selain bawaan Supabase Auth. Belum ada penilaian keamanan pihak ketiga atau uji penetrasi.