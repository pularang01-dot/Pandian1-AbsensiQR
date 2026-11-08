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

## Penghapusan data siswa

Hapus permanen hanya oleh administrator, dengan pratinjau, peringatan, dan konfirmasi ketik HAPUS. Siswa yang memiliki riwayat absensi, izin, dispensasi, atau pulang awal dilindungi basis data dan tidak dapat dihapus; arsipkan lewat status. Setiap penghapusan tercatat di audit log (salinan baris siswa disimpan di log audit). Cadangan basis data tetap memuat data lama sesuai kebijakan cadangan Supabase.

## Siswa lulus dan akun orang tua

Orang tua hanya dapat melihat anak berstatus Aktif; saat anak lulus, pindah, atau nonaktif akses ditutup otomatis oleh basis data (`is_parent_of`). Kelulusan kelas (`graduate_students`) mengarsipkan siswa tanpa menghapus riwayat, mencabut QR, dan opsional menonaktifkan akun orang tua yang tidak punya anak aktif lain. Tentukan masa simpan arsip siswa lulus sesuai kebijakan sekolah.

## Penonaktifan akun otomatis

Harian (pg_cron) dan manual. Hanya menonaktifkan, tidak menghapus. Akun admin, kepala sekolah, Super Admin, dan wali kelas aktif dikecualikan. Setiap proses masuk audit log dan memberi notifikasi admin. Aturan dan masa tunggu diatur di Pengaturan > Kebersihan akun.

## Penghapusan akun

Hanya Super Admin. Akun hanya dapat dihapus permanen bila tidak punya jejak (belum pernah mencatat, meninjau, mengunggah, menjadi wali kelas, atau memberi peran); pemeriksaan dilakukan di server lewat `account_footprint` dan diulang saat menghapus. Akun Super Admin dan akun sendiri tidak dapat dihapus. Akun berjejak cukup dinonaktifkan. Kendali pendaftaran: matikan pendaftaran mandiri di Supabase Auth, buat akun hanya lewat Pengaturan > Pengguna, dan tinjau akun yang belum pernah masuk (tampil pada Perlu perhatian).

## Privasi

- Data anak adalah data sensitif. Kumpulkan seperlunya: tidak menyimpan diagnosis medis, nomor identitas penjemput, atau dokumen identitas.
- Alasan sakit cukup keluhan umum. Catatan peninjauan dapat dibaca orang tua; jangan menulis data sensitif lain.
- Nonaktifkan akun yang tidak lagi bertugas. Tinjau daftar pengguna tiap awal tahun ajaran.
- Tentukan masa simpan data dan dasar persetujuan orang tua sesuai kebijakan sekolah dan peraturan perlindungan data pribadi yang berlaku. Ini keputusan sekolah, bukan bawaan sistem.

## Operasional

Aktifkan MFA untuk akun admin di Supabase dan akun pemilik proyek. Aktifkan backup (PITR bila paket mendukung) dan uji pemulihan. Pakai SMTP sendiri. Batasi anggota proyek Supabase. Terapkan HTTPS pada hosting.

## Batasan yang diketahui

Belum ada pembatasan laju (rate limit) tingkat aplikasi selain bawaan Supabase Auth. Belum ada penilaian keamanan pihak ketiga atau uji penetrasi.

## Pencadangan dan pemulihan
Cadangan hanya dibuat super admin lewat rute server, dienkripsi AES-256-GCM dengan kata sandi yang tidak disimpan, dan tercatat di jejak audit. Pemulihan hanya lewat skrip pemilik memakai kunci service-role di komputer pemilik. Mode pemulihan (migrasi 017) hanya dapat dinyalakan service-role, tertutup dari pengguna, dan kedaluwarsa otomatis 3 jam. Lihat docs/BACKUP_RESTORE_SOP.md.

## Pemantauan error
Pencatat error bawaan menyimpan hanya pesan teknis singkat, halaman, dan jumlah kejadian. Email, deretan angka 6 digit atau lebih, dan id disamarkan di basis data sebelum disimpan; tidak ada isi formulir atau data siswa. Hanya super admin dapat membaca. Tidak ada data keluar ke layanan pihak ketiga. Tabel tidak ikut cadangan.