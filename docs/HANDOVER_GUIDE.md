# Panduan Serah Terima Proyek

## Yang diserahkan

Kode sumber, migrasi 001-008, uji perilaku basis data, data demo opsional, dan dokumentasi di folder docs.

## Keputusan yang harus dikonfirmasi sekolah sebelum dipakai

1. Hari sekolah (bawaan Senin-Jumat; konfirmasi apakah termasuk Sabtu).
2. Jam masuk, batas terlambat, jam penutupan (bawaan 07:00, 07:15, 09:00 hanyalah contoh).
3. Batas hari sakit yang memerlukan dokumen (bawaan 3).
4. Siapa penyetuju izin, dispensasi, dan pulang awal (bawaan: kepala sekolah dan admin).
5. Identitas sekolah: nama resmi, alamat, kontak (dikosongkan; isi sendiri). Nama kepala sekolah dan nomor identitas lembaga tidak diisi sistem.
6. Kebijakan masa simpan data dan persetujuan orang tua.
7. Kebijakan penjemputan dan verifikasi pemohon.

## Langkah go-live

1. Terapkan migrasi 001-008 di proyek Supabase produksi (bukan seed demo).
2. Atur Auth (sign-up dimatikan, URL, templat email, SMTP Brevo; login Google bila dipakai) sesuai README, EMAIL_SETUP_BREVO.md, dan GOOGLE_LOGIN_SETUP.md.
3. Buat administrator awal dengan `bootstrap_super_admin`.
4. Isi pengaturan, tahun ajaran aktif, kalender, kelas; impor siswa (maks 1000 baris per impor).
5. Buat akun guru, operator, kepala sekolah, orang tua dari Pengaturan > Pengguna (staf massal: Impor staf).
6. Cetak kartu QR (Siswa > Kartu QR), bagikan, latih operator.
7. Jalankan seluruh TESTING_CHECKLIST di lingkungan staging terlebih dahulu.

## Pemeliharaan

- Pergantian tahun ajaran: buat tahun baru, aktifkan, buat kelas, pindahkan siswa; arsipkan tahun lama (data tetap).
- Siswa pindah/lulus: ubah status. Pemindaian QR siswa non-aktif ditolak (student_inactive) dan siswa tidak muncul di rekap aktif. Token QR tidak dicabut otomatis; cabut manual bila kartu perlu dinonaktifkan.
- Pemutakhiran dependensi: lakukan di cabang terpisah, jalankan build, lint, typecheck, dan checklist.
- Perubahan basis data: tambah migrasi baru bernomor berurutan; jangan menyunting migrasi yang sudah diterapkan. Fungsi baru wajib `revoke execute ... from public, anon`.

## Diketahui belum ada

Notifikasi eksternal (WhatsApp/SMS/email), antrean offline pemindai, pembatasan laju, pengujian peramban/beban/aksesibilitas otomatis.