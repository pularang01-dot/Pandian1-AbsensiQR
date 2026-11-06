# Prosedur Pencadangan dan Pemulihan Data

Berlaku untuk PANDIAN SMART ATTENDANCE, SDN Pandian 1 Sumenep.

## 1. Membuat cadangan (super admin)
1. Masuk sebagai super admin, buka **Pengaturan > Pencadangan data**.
2. Isi kata sandi cadangan (minimal 12 karakter, dua kali) dan centang pernyataan tanggung jawab.
3. Klik **Buat dan unduh cadangan**. Tunggu sampai berkas `cadangan-pandian-TANGGAL.psabak` terunduh. Jangan tutup halaman.
4. Simpan berkas di **dua tempat berbeda**. Simpan kata sandi cadangan di tempat terpisah dari berkas.

Jadwal yang disarankan: setiap minggu, dan WAJIB sebelum kenaikan kelas, kelulusan, atau penghapusan data siswa/akun.

Isi cadangan: akun login (id dan email), profil, peran, tahun ajaran, kelas, siswa, orang tua dan tautannya, penempatan kelas, token QR, riwayat wali kelas, kalender, pengaturan, absensi, koreksi, izin beserta riwayatnya, dispensasi, pengantaran pulang, notifikasi, dan jejak audit.

Tidak termasuk:
- Kata sandi (tidak dapat diekspor dari Supabase). Setelah pemulihan, pengguna memakai "Lupa kata sandi" atau masuk dengan Google.
- Berkas dokumen izin (foto/PDF) di Supabase Storage bucket dokumen izin. Hanya catatan tabelnya yang tercadang. Untuk berkasnya, unduh manual dari Dashboard Supabase > Storage secara berkala bila dokumen itu penting.
- Pengaturan proyek Supabase (Auth, SMTP/Brevo, Redirect URL) dan variabel environment Vercel. Catat terpisah.

## 2. Memeriksa cadangan (tanpa mengubah apa pun)
Cara termudah, tanpa PowerShell: di halaman **Pengaturan > Pencadangan data**, bagian "Periksa cadangan", pilih berkas dan isi kata sandi. Berkas dibuka di peramban Anda dan tidak diunggah. Dari sana juga bisa diunduh versi Excel yang terbaca. Lihat docs/PANDUAN_SEKOLAH.md.

Cara lewat skrip (untuk pengembang):
Di komputer yang memiliki folder proyek, buka PowerShell di folder proyek:

```
node scripts/backup/restore.mjs verify "C:\lokasi\cadangan-pandian-2026-11-06.psabak"
```
Masukkan kata sandi cadangan. Hasil yang benar: "Berkas valid dan lengkap" beserta jumlah baris tiap tabel. Lakukan ini minimal sebulan sekali agar yakin cadangan benar-benar bisa dibuka.

## 3. Memulihkan ke proyek yang sama (data rusak atau terhapus)
1. Pastikan migrasi 001 sampai 017 sudah dijalankan di proyek tujuan.
2. Pastikan `.env.local` berisi `NEXT_PUBLIC_SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` proyek tujuan (kunci ini rahasia).
3. Uji coba dulu (tidak mengubah apa pun, hanya membandingkan jumlah baris):
```
node scripts/backup/restore.mjs restore "C:\lokasi\berkas.psabak"
```
4. Bila sudah yakin:
```
node scripts/backup/restore.mjs restore "C:\lokasi\berkas.psabak" --apply
```
Ketik nama host proyek yang ditampilkan untuk konfirmasi.

Sifat pemulihan: GABUNG. Baris dengan id yang sama ditimpa dengan isi cadangan; baris yang tidak ada di cadangan tidak dihapus. Jadi data yang dibuat setelah cadangan tetap aman, tetapi perubahan pada baris yang sama sesudah cadangan akan kembali ke keadaan cadangan. Selama pemulihan, trigger audit dan updated_at dimatikan sementara (mode pemulihan otomatis kedaluwarsa 3 jam), lalu satu catatan `restore_completed` ditulis di jejak audit.

## 4. Pemulihan total (proyek hilang atau pindah proyek baru)
1. Buat proyek Supabase baru. Jalankan migrasi 001 sampai 017 berurutan di SQL Editor (satu per satu).
2. Atur ulang Auth (Site URL, Redirect URL, Google, SMTP Brevo) dan environment Vercel ke proyek baru.
3. Perbarui `.env.local` ke proyek baru, lalu jalankan langkah 3 di atas dengan `--apply`. Akun login dibuat ulang dengan id yang sama agar semua relasi tetap utuh.
4. Aktifkan pg_cron dan jadwal penonaktifan akun (lihat README).
5. Minta semua pengguna memakai "Lupa kata sandi" atau masuk dengan Google. Uji masuk sebagai super admin, cek jumlah siswa, absensi hari ini, dan satu laporan.

## 5. Catatan keamanan
- Berkas cadangan memuat data pribadi anak. Jangan kirim lewat grup chat atau email biasa.
- Enkripsi AES-256-GCM; kunci diturunkan dari kata sandi dengan PBKDF2-SHA256 (600.000 putaran). Cadangan lama berformat v1 (scrypt) masih dapat dibaca skrip pemulihan, tetapi tidak oleh halaman web. Tanpa kata sandi, tidak ada yang dapat membuka berkas, termasuk developer.
- Berkas yang terpotong atau diubah ditolak otomatis.
- Cadangan hanya dapat dibuat oleh super admin dan setiap pembuatannya tercatat (`backup_started`, `backup_completed`).
- Kunci service-role hanya dipakai di server (rute cadangan) dan di komputer pemilik (skrip). Jangan ditempel di chat.
- Supabase paket gratis tidak menyediakan pemulihan titik waktu (PITR); cadangan ini adalah perlindungan utama Anda.

## 6. Batasan yang jujur
- Skrip pemulihan belum diuji pada proyek Supabase sungguhan oleh pengembang; yang teruji: format dan enkripsi berkas (buka, salah sandi, berkas terpotong) dan mode pemulihan di database lokal. Lakukan latihan pemulihan pada proyek Supabase percobaan SEBELUM benar-benar membutuhkannya.
- Pembuatan ulang akun dengan id yang sama memakai API admin GoTrue (parameter `id`); bila proyek menolak, skrip melaporkan galat per akun.