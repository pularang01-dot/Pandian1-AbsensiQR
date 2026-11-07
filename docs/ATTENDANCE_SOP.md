# SOP Absensi Harian

Nilai jam di bawah adalah contoh bawaan. Sekolah wajib menetapkan jam dan hari sekolah di Pengaturan > Aturan absensi.

## Prinsip

- Pindai QR BUKAN bukti kehadiran fisik. Operator wajib memastikan siswa benar-benar hadir dan memeriksa nama yang tampil sebelum menekan Konfirmasi.
- Sistem tidak menandai semua siswa Alpa otomatis. Alpa hanya lahir dari rekonsiliasi yang dijalankan petugas.
- Data absensi tidak pernah ditimpa tanpa jejak. Setiap koreksi menyimpan status lama, status baru, alasan, pelaku, dan waktu.

## Alur harian

1. Sebelum jam masuk: operator membuka Pemindai QR. Sesi absensi hari itu dibuat otomatis bila hari tersebut hari sekolah (bukan libur kalender).
2. Siswa tiba: pindai kartu QR. Layar menampilkan nama dan kelas siswa. Operator mencocokkan dengan siswa di depannya, lalu Konfirmasi. Status Hadir bila sebelum batas terlambat, Terlambat bila sesudahnya.
3. Siswa lupa kartu: gunakan pencatatan manual (cari nama), dengan catatan.
4. Kartu hilang atau disalahgunakan: administrator menerbitkan ulang QR di rincian siswa. Token lama langsung dicabut.
5. Setelah jam penutupan: administrator menjalankan Rekonsiliasi seluruh sekolah (sesi ditutup); wali kelas menjalankannya hanya untuk kelasnya sendiri (sesi tidak ditutup). Siswa tanpa catatan dan tanpa izin disetujui menjadi Alpa; siswa dengan izin/sakit/dispensasi disetujui mengikuti statusnya. Sebelum jam penutupan sistem menolak rekonsiliasi.
6. Salah catat: Koreksi dari halaman Data Absensi, wajib alasan minimal 5 karakter.

## Status

Hadir, Terlambat (keduanya kehadiran fisik); Sakit, Izin (ketidakhadiran bersetuju); Kegiatan Resmi Sekolah (dispensasi, dihitung terpisah); Alpa; Belum Diverifikasi (perlu ditindaklanjuti). Status selalu ditampilkan dengan ikon dan teks.

## Kegagalan jaringan

Pemindai tidak menyimpan antrean offline. Bila gagal, layar menyatakan data BELUM tersimpan. Catat manual di kertas lalu input ulang setelah koneksi pulih; jangan menganggap pindaian berhasil tanpa tanda konfirmasi.

## Absen kelas (pilih status per siswa)
Menu **Absen Kelas** memudahkan wali kelas mencatat kehadiran tanpa memindai QR: daftar siswa kelas tampil, wali kelas memilih Hadir, Terlambat, Sakit, Izin, atau Alpa, lalu menyimpan sekaligus.

Aturan:
- Wali kelas hanya dapat mengabsen kelas yang ia ampu. Administrator dan operator dapat memilih kelas mana pun.
- Hanya untuk hari ini, pada hari sekolah, selama sesi belum ditutup.
- Siswa yang tidak dipilih tidak dicatat dan TIDAK otomatis Alpa. Alpa hanya bila dipilih.
- Catatan yang sudah ada (QR, izin disetujui, dispensasi) tidak ditimpa. Perubahan lewat Koreksi dengan alasan.
- Sumber catatan: Manual. Setiap paket tersimpan tercatat di jejak audit.
- Sakit atau Izin yang dipilih guru adalah catatan kehadiran oleh guru, BUKAN persetujuan pengajuan izin. Surat atau pengajuan resmi orang tua tetap diproses di menu Izin & Sakit.
- Absensi QR bukan bukti kehadiran fisik yang mutlak, dan absensi manual juga bergantung pada kejujuran pencatat; itu sebabnya semua tercatat dan dapat diaudit.