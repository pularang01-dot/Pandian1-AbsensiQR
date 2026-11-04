Saya sudah membuat dua skrip SQL untuk menghapus siswa demo, dan skrip ini hanya bisa Anda jalankan lewat Supabase. Aplikasi, migrasi, dan fitur hapus di web tidak saya ubah. Skripnya saya uji pada basis data lokal dengan data riwayat lengkap, dan hasilnya benar. Dalam uji itu saya sempat menemukan satu urutan hapus yang salah, dan sudah saya perbaiki.

Kenapa hanya Anda yang bisa

Skrip dijalankan di Supabase > SQL Editor, yang hanya bisa dibuka pemilik proyek. Pengguna aplikasi, termasuk Super Admin, tidak punya jalur ini. Skrip ini juga menghapus siswa beserta seluruh riwayatnya, berbeda dengan tombol di web yang melindungi siswa berriwayat.

Cara memakainya

Buka Supabase > SQL Editor > New query.
Tempel isi 1_lihat_siswa_demo.sql lalu Run. Skrip ini hanya menampilkan daftar siswa yang akan dihapus beserta jumlah riwayatnya, dan tidak mengubah data. Pastikan daftarnya benar.
Jika yang ingin dihapus bukan siswa demo bawaan (misalnya siswa uji yang Anda tambah atau impor sendiri), tulis NIS-nya pada nis_tambahan, misalnya array['1188','4723']. Isi yang sama di kedua skrip. Untuk melihat semua NIS, jalankan baris select ... from public.students yang saya beri tanda komentar di bagian bawah.
Buat query baru, tempel isi 2_hapus_siswa_demo.sql, ubah kata_konfirmasi text := ''; menjadi := 'HAPUS';, lalu Run. Tanpa perubahan itu skrip menolak dan tidak mengubah apa pun.
Jalankan skrip langkah 1 lagi. Hasilnya seharusnya kosong.

Yang terhapus

Data siswa, catatan absensi dan koreksinya, izin/sakit, dispensasi, pulang awal, penempatan kelas, tautan orang tua, dan QR. Dispensasi yang jadi kosong ikut terhapus. Semuanya berjalan dalam satu transaksi: jika satu langkah gagal, tidak ada yang berubah. Penghapusan dicatat di audit log sebagai manual_delete_students berisi jumlahnya saja, tanpa nama siswa.

Perhatian

Tidak bisa dibatalkan. Cek daftar langkah 1 dengan teliti, terutama jika memakai nis_tambahan.
Jika ada dokumen izin yang diunggah, barisnya terhapus tetapi berkas aslinya tetap ada di Storage > permission-documents. Skrip memberi pemberitahuan jumlahnya, dan Anda perlu menghapusnya manual lewat dashboard.
Kelas contoh “DEMO 1A/1B” tidak ikut terhapus. Baris opsional untuk itu ada di akhir skrip langkah 2, dalam bentuk komentar.
Data nyata aman selama tidak bertanda demo dan NIS-nya tidak Anda tulis di nis_tambahan.

Kedua file berada di folder supabase\tools\ pada proyek, jadi Anda cukup menambahkannya ke sana jika ingin menyimpannya di repositori. Keduanya tidak dipakai otomatis oleh aplikasi.