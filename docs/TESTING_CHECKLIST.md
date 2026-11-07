# Checklist Pengujian

## Sudah dijalankan (jujur)

- Basis data: PostgreSQL 16 lokal dengan stub auth/storage, migrasi 001-016 diterapkan bersih, `behavior_test.sql`: 181 PASS, 0 FAIL. Mencakup RLS per peran, RPC absensi/izin/dispensasi/pulang awal, pembatasan guru pada kelas, penolakan orang tua, tahun ajaran atomik, impor siswa, notifikasi.
- Seed demo dan cleanup: diterapkan, idempoten, bersih.
- Kode aplikasi: pemeriksaan sintaks (130 berkas), kesesuaian impor internal dan ekspor bernama, aturan "use server" (hanya fungsi async).
- Logika attendance-calc diuji unit secara terpisah.

## BELUM dijalankan (wajib sebelum produksi)

Jalankan setelah `npm install`: `npm run typecheck`, `npm run lint`, `npm run build`. Uji pada Supabase asli (bukan stub), termasuk RLS dengan JWT nyata.

## Uji manual per modul (staging)

Autentikasi: masuk gagal/berhasil; akun nonaktif ditolak; reset kata sandi lewat email; tautan kedaluwarsa; akses halaman tanpa login dialihkan; peran salah ditolak.
Absensi: pindai berhasil; token dicabut ditolak; pindai ganda tidak menggandakan; Hadir vs Terlambat tepat di batas; hari libur; setelah penutupan; gagal jaringan menampilkan pesan BELUM tersimpan; koreksi berjejak; rekonsiliasi sebelum/sesudah penutupan; guru tidak bisa mencatat siswa kelas lain.
Hapus siswa: peringatan tampil sebelum menghapus; harus mengetik HAPUS; siswa berriwayat dilindungi dan dilaporkan; hapus per siswa dan per kelas; QR ikut terhapus; tercatat di audit; guru dan operator ditolak.
Siswa/kelas: tambah, ubah, pindah kelas (riwayat tetap), impor dengan baris salah, ekspor, kartu QR, terbit ulang QR.
Izin: ajukan, dokumen sah/tidak sah (ganti ekstensi), >5 MB, retroaktif wajib catatan, tumpang tindih ditolak, setujui menerapkan per hari dan melewati libur, tidak menimpa Hadir, batal persetujuan, orang tua tidak melihat anak lain, signed URL kedaluwarsa.
Dispensasi: atomik, guru kelas lain ditolak, setujui tidak mengubah absensi, konfirmasi ikut serta mencatat, tidak ikut menandai ditinjau, selesai menandai belum dikonfirmasi.
Pulang awal: setujui butuh verifikasi, serah terima cocok/tidak cocok, satu serah terima berhasil, QR tidak berperan.
Laporan: angka harian = dashboard; bulanan; per siswa; ekspor XLSX/CSV/PDF; sel berawalan = diberi apostrof; guru hanya kelasnya.
Login Google: akun terdaftar berhasil masuk; Gmail tidak terdaftar ditolak dan sesi ditutup; akun nonaktif ditolak; email Google beda dari yang didaftarkan ditolak; tombol hanya muncul bila flag true; pendaftaran mandiri Supabase nonaktif; tautan identitas ke akun yang dibuat admin bekerja (uji pada Supabase asli).
Impor staf: baris valid dibuat dan undangan tiba; email ganda dalam berkas dilewati; peran tak dikenal gagal; school_admin tidak dapat mengimpor Kepala Sekolah/Admin; kelas tak ada atau sudah punya wali ditolak sebelum akun dibuat; kegagalan satu baris tidak membatalkan baris lain; kirim ulang undangan; Brevo/SMTP gagal menampilkan pesan jelas.
Wali kelas: akun guru baru muncul di daftar wali; ubah wali; pindah/tukar wali antar kelas; menonaktifkan akun mengosongkan kelasnya dan menampilkan peringatan; pencabutan peran guru mengosongkan kelas; riwayat wali tampil; guru tidak melihat riwayat.
Kebersihan akun: pengaturan tersimpan; pratinjau jumlah akun; Jalankan sekarang menonaktifkan; orang tua dalam masa tunggu tidak disentuh; akun admin dan wali kelas tidak disentuh; nilai 0 mematikan aturan; audit log dan notifikasi admin; jadwal pg_cron aktif (uji pada Supabase asli).
Kenaikan kelas: pratinjau menampilkan hitungan dan masalah; rencana salah tidak mengubah apa pun; naik kelas, tidak naik kelas, kelas lain, pindah sekolah, berhenti, lulus; kelas tak dipetakan tidak disentuh; menjalankan ulang tidak menggandakan; buat kelas otomatis tahun tujuan; status keluar menutup penempatan dan mencabut QR; guru ditolak.
Kelulusan: pratinjau dampak; harus mengetik LULUS; siswa menjadi Lulus dan penempatan ditutup; QR dicabut; orang tua tak lagi melihat anak lulus; akun orang tua tanpa anak aktif dinonaktifkan (opsional); orang tua dengan anak aktif lain tetap aktif; guru ditolak; pembersihan orang tua yatim dari halaman Pengguna.
Hapus akun (Super Admin): pratinjau dan peringatan tampil; harus mengetik HAPUS; akun berjejak dilindungi dan alasannya tampil; akun Super Admin dan akun sendiri ditolak; admin sekolah tidak melihat tombol; pembersihan massal akun belum pernah masuk; email dan waktu masuk terakhir tampil.
Pengaturan: validasi jam; tahun ajaran satu aktif; kalender; pembuatan akun (undangan terkirim, gagal membatalkan akun); school_admin tidak dapat memberi peran admin; minimal satu Super Admin.
Aksesibilitas dan perangkat: navigasi keyboard, label formulir, kontras, status bukan hanya warna, layar ponsel 360 px, pemindai pada ponsel Android/iOS nyata dan pencahayaan kelas.
Keamanan: kunci service-role tidak muncul di bundel klien (periksa hasil build), header keamanan, upaya akses data lintas peran lewat API Supabase langsung.
Beban: pindai beruntun saat jam masuk (misalnya 200 siswa dalam 15 menit).

## Pencadangan dan pemulihan
- [ ] Super admin: Pengaturan > Pencadangan data tampil; school_admin TIDAK melihat kartunya dan /settings/backup dialihkan.
- [ ] Buat cadangan dengan kata sandi < 12 karakter ditolak; dua kata sandi berbeda ditolak; tanpa centang ditolak.
- [ ] Cadangan terunduh (.psabak) dan riwayat cadangan + audit `backup_started`/`backup_completed` muncul.
- [ ] `node scripts/backup/restore.mjs verify` dengan kata sandi benar: valid; kata sandi salah: ditolak.
- [ ] Latihan pemulihan di proyek Supabase percobaan: `restore` (uji coba) lalu `--apply`; jumlah baris cocok, masuk dengan Google/Lupa kata sandi berhasil.
- [ ] Halaman Pencadangan > Periksa cadangan: berkas benar + sandi benar menampilkan pesan hijau dan tabel jumlah; sandi salah ditolak; berkas bukan .psabak ditolak.
- [ ] Unduh versi Excel: 5 lembar (Siswa, Kelas, Rekap absensi, Absensi harian, Izin) terbuka di Excel, nama beraksen tampil benar, tidak ada kolom alasan izin.

## Logo dan PWA
- [ ] Halaman masuk: lambang tampil tajam di panel kiri (desktop) dan di atas formulir (ponsel); menu samping memuat lambang dalam kotak putih.
- [ ] Tab browser menampilkan ikon lambang; setelah deploy, /manifest.webmanifest terbuka tanpa masuk (tidak dialihkan ke login).
- [ ] Chrome Android: muncul tombol "Pasang aplikasi"; setelah dipasang, ikon di layar utama berbentuk lambang utuh (tidak terpotong) dan aplikasi terbuka tanpa bilah alamat.
- [ ] iPhone Safari: petunjuk "Tambahkan ke Layar Utama" tampil; ikon benar.
- [ ] Matikan internet lalu buka aplikasi terpasang: tampil halaman "Tidak ada sambungan internet", bukan data siswa.
- [ ] DevTools > Application > Service Workers: hanya sw.js; Cache Storage hanya berisi offline.html, logo, dan ikon.
- [ ] Laporan harian/bulanan/per siswa: Cetak (Ctrl+P) menampilkan kop berlogo di atas tabel; kop tidak tampil di layar biasa.
- [ ] Ekspor PDF: kop berlogo, nama sekolah, serta alamat dan telepon (bila diisi di Pengaturan) tampil rapi dan tabel tidak menimpa kop.
- [ ] Ekspor Excel dan CSV: baris pertama berisi nama sekolah (tanpa gambar).
- [ ] Cetak kartu QR: lambang kecil tampil di samping nama sekolah pada tiap kartu.
- [ ] Banner "Pasang Pandian Absensi" muncul sekitar 3 detik setelah halaman terbuka (Chrome Android atau Edge, produksi). Tombol Pasang membuka dialog bawaan; Nanti/X menutup dan banner tidak muncul lagi selama 14 hari.
- [ ] iPhone Safari: banner berisi petunjuk Bagikan > Tambahkan ke Layar Utama, tombol Mengerti menutupnya.
- [ ] Setelah aplikasi terpasang, banner dan tombol Pasang aplikasi tidak muncul lagi.

## Absen kelas
- [ ] Guru wali kelas: menu Absen Kelas menampilkan daftar siswa kelasnya saja; guru tanpa kelas melihat pesan "belum ditetapkan sebagai wali kelas".
- [ ] Pilih status beberapa siswa, ketuk status yang sama lagi membatalkan pilihan; Sakit/Izin/Alpa memunculkan kolom catatan opsional.
- [ ] "Pilih Hadir untuk yang belum dipilih" hanya mengisi yang kosong; tidak ada yang tersimpan sebelum menekan Simpan dan konfirmasi.
- [ ] Setelah simpan: siswa berstatus terkunci dengan label sumber Manual; siswa tidak dipilih tetap tanpa catatan (bukan Alpa).
- [ ] Siswa yang sudah dipindai QR tampil terkunci dan tidak bisa diubah dari halaman ini.
- [ ] Admin: dapat memilih kelas lain; guru tidak bisa membuka kelas lain lewat ?class= di alamat.
- [ ] Dashboard memperlihatkan angka terbaru; entri audit "class_attendance" muncul.
- [ ] Tampilan ponsel: lima tombol status muat satu baris, mudah ditekan, bilah Simpan di bawah tidak menutupi baris terakhir.
- [ ] Antara pukul 06.00-07.00 WIB, "hari ini" di dashboard dan Absen Kelas sudah tanggal hari ini (bukan kemarin).

## Aktivitas administrasi
- [ ] Menu Aktivitas muncul untuk super admin, admin sekolah, dan kepala sekolah; TIDAK untuk guru, operator, dan orang tua (membuka /activity dialihkan).
- [ ] Daftar menampilkan kalimat Indonesia, nama pelaku, tanggal dan jam WIB yang benar (cocokkan dengan jam di ponsel).
- [ ] Ubah status satu siswa, lalu cek: muncul "Mengubah data siswa: NAMA" dengan "Status: aktif menjadi ..." dan rincian Sebelum/Sesudah.
- [ ] Filter Jenis, Dilakukan oleh, rentang tanggal bekerja; paginasi mempertahankan filter.
- [ ] Pemindaian QR harian tidak membanjiri daftar; centang "Sertakan perubahan rutin" menampilkannya.
- [ ] Rincian tidak pernah menampilkan token QR atau kata sandi (tertulis "(disembunyikan)").
- [ ] Link "Lihat semua" di kartu dashboard membuka halaman ini.
- [ ] Jam di Data absensi dan dashboard sekarang menurut WIB (pindai pukul 06.45 tampil 06:45, bukan 23:45).