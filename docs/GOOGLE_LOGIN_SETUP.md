# Login dengan Google (untuk staf)

Staf masuk dengan tombol "Masuk dengan Google". Ini TAMBAHAN: email dan kata sandi tetap berfungsi. Hanya akun yang sudah didaftarkan administrator (aktif dan punya peran) yang dapat masuk; akun Google lain ditolak dan sesinya ditutup.

## Cara kerja singkat

1. Administrator mendaftarkan guru/staf dengan cara masuk "Akun Google" (Pengaturan > Pengguna, atau Impor staf). Tidak ada email yang dikirim, jadi tidak memerlukan SMTP/Brevo.
2. Guru membuka halaman login, menekan Masuk dengan Google, memilih akun yang emailnya SAMA dengan yang didaftarkan.
3. Supabase menautkan identitas Google ke akun yang sudah ada (berdasarkan email terverifikasi). Aplikasi memeriksa akun aktif dan punya peran; bila tidak, sesi ditutup dan muncul pesan.

Email di Google harus persis sama dengan email yang didaftarkan admin. Bila beda, akun Google itu ditolak.

## 1. Google Cloud

1. https://console.cloud.google.com : buat proyek (atau pakai yang ada).
2. APIs & Services > OAuth consent screen (di versi baru bernama Google Auth Platform):
   - User type: External (untuk Gmail biasa). Internal hanya bila sekolah memakai Google Workspace dan semua staf ada di organisasi itu.
   - Isi nama aplikasi, email dukungan, email kontak pengembang.
   - Scope cukup bawaan: email, profile, openid (tidak perlu verifikasi Google).
   - Publishing status: pindahkan ke In production. Pada status Testing hanya "test users" yang bisa masuk dan sesinya dibatasi.
3. Credentials > Create credentials > OAuth client ID > Web application:
   - Authorized redirect URIs: `https://<ID-PROYEK-SUPABASE>.supabase.co/auth/v1/callback` (persis seperti tertera di halaman provider Google di Supabase).
   - Salin Client ID dan Client secret. Simpan secret di pengelola kata sandi, jangan di chat atau kode.

## 2. Supabase

1. Authentication > Providers > Google: aktifkan, tempel Client ID dan Client secret.
2. Authentication > Sign In / Providers (pengaturan umum): pastikan "Allow new users to sign up" NONAKTIF, agar akun Google asing tidak membuat akun baru.
3. Authentication > URL Configuration: Site URL = alamat aplikasi; tambahkan `<alamat>/auth/callback` ke Redirect URLs.

## 3. Aplikasi

Di `.env.local` (dan di pengaturan hosting) set:

```
NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED=true
NEXT_PUBLIC_APP_URL=https://alamat-aplikasi-anda
```

Build ulang aplikasi (variabel NEXT_PUBLIC_ dibaca saat build). Tombol Google baru muncul di halaman login setelah flag ini true.

## 4. Uji

1. Daftarkan akun uji (email Gmail Anda) dengan cara masuk Akun Google, peran Guru.
2. Masuk dengan Google: harus berhasil dan masuk ke dashboard sesuai peran.
3. Coba dengan Gmail lain yang TIDAK didaftarkan: harus muncul "Akun Google ini belum terdaftar atau belum aktif" dan tidak ada akses.
4. Nonaktifkan akun uji dari daftar Pengguna lalu coba masuk lagi: harus ditolak.

## Pemecahan masalah

| Gejala | Penyebab umum |
| --- | --- |
| redirect_uri_mismatch dari Google | Redirect URI di Google Cloud tidak sama persis dengan yang di Supabase |
| "Masuk dengan Google gagal" | Provider belum aktif, Client ID/secret salah, atau Redirect URL aplikasi belum didaftarkan |
| "Akun Google ini belum terdaftar" | Email Google berbeda dari yang didaftarkan, akun nonaktif, atau belum punya peran |
| Hanya beberapa orang bisa masuk | Consent screen masih berstatus Testing |
| Tombol Google tidak muncul | NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED belum true atau belum build ulang |

## Catatan keamanan

- Aplikasi tidak pernah melihat kata sandi Google. Peran dan aktif/nonaktif tetap diatur di sistem ini; menonaktifkan akun menutup akses meski akun Google masih ada.
- Penautan otomatis berdasarkan email mengandalkan email terverifikasi dari Google. Gunakan hanya alamat yang benar-benar dimiliki staf; hindari alamat bersama.
- Orang tua dapat memakai cara yang sama bila terdaftar, namun alur utama mereka tetap email dan kata sandi.
- Perilaku penautan identitas Supabase dapat berbeda antarversi; langkah uji di atas wajib dijalankan, terutama langkah 2 dan 3.