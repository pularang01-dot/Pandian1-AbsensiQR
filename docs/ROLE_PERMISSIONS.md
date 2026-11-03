# Peran dan Hak Akses

Penegakan ada di RLS dan fungsi basis data. Halaman Pengaturan > Peran hanya referensi.

| Fitur | Super Admin | Admin Sekolah | Kepala Sekolah | Guru | Operator | Orang Tua |
| --- | --- | --- | --- | --- | --- | --- |
| Lihat data siswa | Semua | Semua | Semua | Kelas sendiri | Terbatas | Anak sendiri |
| Catat absensi (QR/manual) | Ya | Ya | Tidak | Kelas sendiri | Ya | Tidak |
| Koreksi absensi (alasan wajib, berjejak) | Ya | Ya | Ya | Kelas sendiri | Tidak | Tidak |
| Ajukan izin/sakit | Atas nama | Atas nama | Tidak | Tidak | Tidak | Anak sendiri |
| Setujui izin, dispensasi, pulang awal | Ya | Ya | Ya | Tidak | Tidak | Tidak |
| Ajukan dispensasi | Ya | Ya | Ya | Kelas sendiri | Tidak | Tidak |
| Konfirmasi partisipasi dispensasi | Ya | Ya | Tidak | Guru pendamping | Tidak | Tidak |
| Catat serah terima pulang awal | Ya | Ya | Ya | Ya | Ya | Tidak |
| Ajukan pulang awal | Atas nama | Atas nama | Atas nama | Atas nama | Atas nama | Anak sendiri |
| Laporan dan ekspor | Ya | Ya | Ya | Kelas sendiri | Tidak | Tidak |
| Ekspor data siswa | Ya | Ya | Ya | Tidak | Tidak | Tidak |
| Pengaturan | Ya | Ya | Tidak | Tidak | Tidak | Tidak |
| Kelola peran | Semua | Guru, operator, orang tua | Tidak | Tidak | Tidak | Tidak |

Aturan khusus:
- Akun baru nonaktif dan tanpa peran sampai dibuat/diaktifkan administrator.
- Peran orang tua tidak boleh digabung dengan peran staf.
- Minimal satu Super Admin harus ada; Super Admin tidak dapat mencabut perannya sendiri atau menonaktifkan akunnya sendiri.
- Akun nonaktif tidak lolos pemeriksaan peran basis data.
- Orang tua hanya melihat anak dengan tautan aktif. Memutus tautan langsung menghentikan akses.
- Siapa yang berhak menyetujui adalah keputusan sekolah. Default: Super Admin, Admin Sekolah, Kepala Sekolah.
