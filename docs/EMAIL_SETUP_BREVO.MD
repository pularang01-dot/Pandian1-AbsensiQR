# Pengiriman Email Undangan lewat Brevo (SMTP)

Aplikasi tidak mengirim email sendiri. Undangan akun, tautan buat/reset kata sandi dikirim oleh Supabase Auth, dan Supabase dapat memakai SMTP pihak ketiga seperti Brevo. Login pengguna tetap email + kata sandi; yang berubah hanya jalur pengirim email. Tidak ada perubahan kode yang diperlukan untuk menghubungkan Brevo.

## 1. Siapkan Brevo

1. Buat akun di Brevo dan verifikasi.
2. Tambahkan pengirim: Senders, Domains & Dedicated IPs. Idealnya autentikasi domain sekolah (DKIM dan DMARC, serta SPF sesuai petunjuk Brevo) agar email tidak masuk spam. Tanpa domain sendiri, minimal verifikasi satu alamat pengirim.
3. Buka SMTP & API > SMTP. Catat: server `smtp-relay.brevo.com`, port `587` (STARTTLS), Login SMTP (tertera di halaman itu), dan buat SMTP key. Kata sandi SMTP adalah SMTP key, bukan kata sandi akun Brevo. Simpan key di pengelola kata sandi; jangan ditempel di chat atau kode.

## 2. Hubungkan ke Supabase

Dashboard Supabase > Authentication > SMTP Settings (letak menu dapat bergeser antarversi dashboard):

| Kolom | Isi |
| --- | --- |
| Enable custom SMTP | Aktif |
| Sender email | Alamat pengirim yang sudah diverifikasi di Brevo |
| Sender name | Nama sekolah, misalnya "SDN Pandian 1 Sumenep" |
| Host | smtp-relay.brevo.com |
| Port | 587 |
| Username | Login SMTP dari Brevo |
| Password | SMTP key dari Brevo |

Lalu Authentication > Rate Limits: naikkan batas email per jam bila Anda mengimpor banyak staf (batas bawaan setelah SMTP kustom cukup rendah). Impor staf diproses berurutan dan maksimal 50 baris per unggahan untuk menghormati batas ini.

## 3. Templat email dan URL

- Authentication > URL Configuration: Site URL = alamat aplikasi (HTTPS). Tambahkan `<alamat>/auth/callback` ke Redirect URLs.
- Authentication > Email Templates, templat Invite user dan Reset password: ubah tautan menjadi
  - Invite: `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=invite&next=/reset-password`
  - Reset: `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`
- `NEXT_PUBLIC_APP_URL` di `.env.local` harus sama dengan Site URL.

## 4. Uji sebelum dipakai

1. Buat satu akun uji dengan email Anda sendiri dari Pengaturan > Pengguna.
2. Email tiba (periksa spam), klik tautan, buat kata sandi, masuk.
3. Dari daftar Pengguna, coba Kirim ulang undangan.
4. Barulah impor staf massal (Pengaturan > Pengguna > Impor staf).

## Pemecahan masalah

| Gejala | Kemungkinan penyebab |
| --- | --- |
| "Undangan gagal dikirim" | SMTP salah (username/key), pengirim belum diverifikasi, port diblokir. Lihat Logs > Auth di Supabase |
| "Batas pengiriman email tercapai" | Rate limit Supabase atau kuota harian paket Brevo (cek kuota di akun Brevo) |
| Email masuk spam | Domain pengirim belum diautentikasi (DKIM/SPF/DMARC) |
| Tautan "tidak valid atau kedaluwarsa" | Tautan sudah dipakai atau lama; gunakan Kirim ulang undangan. Pemindai email otomatis kadang membuka tautan lebih dulu |
| Email ganda terdaftar | Akun sudah ada; gunakan Kirim ulang undangan, bukan buat ulang |

## Soal "login pihak ketiga"

Bila yang diinginkan adalah staf masuk dengan akun Google/Microsoft (SSO), itu fitur berbeda dari Brevo dan belum dibuat. Dapat ditambahkan dengan provider OAuth Supabase, dengan syarat hanya email yang sudah diundang admin yang boleh masuk.