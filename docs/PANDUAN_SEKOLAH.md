# Panduan Cadangan Data untuk Pihak Sekolah (bahasa awam)

Panduan ini ditulis untuk kepala sekolah, operator, atau staf yang tidak memakai PowerShell atau menulis kode.

## Apa itu cadangan?
Salinan seluruh data aplikasi (siswa, kelas, absensi, izin, dan lainnya) dalam satu berkas berakhiran `.psabak`. Jika data hilang atau rusak, salinan ini dipakai untuk mengembalikannya.

Berkas `.psabak` dikunci dengan **kata sandi cadangan**. Word, Acrobat, dan aplikasi lain memang tidak bisa membukanya. Itu disengaja demi keamanan data anak.

## Yang harus dilakukan setiap minggu (5 menit)
1. Masuk ke aplikasi dengan akun **super admin**.
2. Buka **Pengaturan > Pencadangan data**.
3. Pada "Buat cadangan baru": ketik kata sandi cadangan dua kali (minimal 12 karakter), centang pernyataan, klik **Buat dan unduh cadangan**. Tunggu sampai berkas terunduh.
4. Salin berkas ke **dua tempat berbeda**, misalnya flashdisk milik sekolah dan penyimpanan daring resmi sekolah. Jangan dikirim lewat grup WhatsApp.
5. Pada "Periksa cadangan": pilih berkas tadi, ketik kata sandi, klik **Periksa cadangan**. Harus muncul pesan hijau "Cadangan utuh dan dapat dibuka" beserta jumlah siswa dan absensi.

Buat cadangan tambahan **sebelum** kenaikan kelas, kelulusan, atau menghapus data siswa atau akun.

## Melihat isi cadangan sebagai Excel
Setelah "Periksa cadangan" berhasil, klik **Unduh versi Excel (terbaca)**. Berkas Excel berisi daftar siswa, kelas, rekap absensi, absensi harian, dan daftar izin. Berkas Excel ini TIDAK dikunci, jadi simpan sebagai dokumen rahasia dan hapus bila tidak diperlukan.

## Kata sandi cadangan: aturan penting
- Jangan ditulis di tempat yang sama dengan berkas cadangan.
- Pegang oleh **minimal dua orang** (misalnya kepala sekolah dan satu operator), dicatat di amplop tertutup yang disimpan di tempat aman sekolah.
- Jika kata sandi hilang, cadangan **tidak bisa dibuka oleh siapa pun**, termasuk pembuat aplikasi. Buat cadangan baru segera.

## Jika data rusak atau terhapus
Saat ini pemulihan dilakukan oleh seorang pengembang memakai skrip (lihat docs/BACKUP_RESTORE_SOP.md). Bawakan berkas cadangan terbaru dan kata sandinya. Jangan menghapus atau mengubah apa pun lagi di aplikasi sampai pengembang datang.

## Daftar serah terima (diisi sebelum tim PPL selesai)
- [ ] Akun super admin dipegang email resmi sekolah, bukan email pribadi mahasiswa. Minimal dua orang sekolah punya akun super admin.
- [ ] Kepemilikan proyek Supabase, Vercel, dan GitHub dipindah ke akun email resmi sekolah, atau pihak sekolah ditambahkan sebagai pemilik (Owner).
- [ ] Berkas `.env.local` dan kunci rahasia (service-role key) diserahkan lewat cara aman, bukan chat, dan hanya kepada orang yang ditunjuk sekolah.
- [ ] Pihak sekolah sudah mencoba sendiri: membuat cadangan, memeriksa cadangan, dan mengunduh Excel.
- [ ] Kata sandi cadangan dicatat dan disimpan oleh dua orang sekolah.
- [ ] Latihan pemulihan sudah dilakukan bersama developer pada proyek Supabase percobaan, dan hasilnya dicatat.
- [ ] Nama dan kontak seorang pengembang atau pihak kampus yang bisa dihubungi bila ada masalah teknis, ditulis oleh sekolah sendiri: ____________
- [ ] Jadwal pencadangan mingguan ditetapkan, dengan nama petugasnya: ____________