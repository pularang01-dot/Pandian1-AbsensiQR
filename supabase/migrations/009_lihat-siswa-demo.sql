-- PANDIAN SMART ATTENDANCE - ALAT KHUSUS PEMILIK PROYEK (jalankan di Supabase > SQL Editor)
-- LANGKAH 1 dari 2: LIHAT dulu siswa mana yang akan dihapus. Berkas ini TIDAK mengubah data apa pun.
--
-- Siswa yang dipilih = siswa bertanda demo (is_demo = true, hasil demo_seed.sql)
--                      ATAU siswa yang NIS-nya Anda tulis pada daftar di bawah.
-- Daftar NIS tambahan (opsional). Contoh: array['1188','4723']. Kosongkan bila hanya data demo.
with pilihan as (
  select array[]::text[] as nis_tambahan   -- <== ubah di sini bila perlu, samakan dengan berkas langkah 2
)
select
  s.nis, s.full_name as nama, s.status, s.is_demo,
  (select c.name from public.student_class_assignments a join public.classes c on c.id = a.class_id
     where a.student_id = s.id and a.end_date is null limit 1) as kelas,
  (select count(*) from public.attendance_records r where r.student_id = s.id) as catatan_absensi,
  (select count(*) from public.permission_requests p where p.student_id = s.id) as izin_sakit,
  (select count(*) from public.dispensation_students d where d.student_id = s.id) as dispensasi,
  (select count(*) from public.early_dismissal_requests e where e.student_id = s.id) as pulang_awal
from public.students s, pilihan
where s.is_demo or s.nis = any(pilihan.nis_tambahan)
order by s.nis;

-- Untuk melihat SEMUA siswa (mencari NIS yang ingin ditambahkan), jalankan terpisah:
-- select nis, full_name, status, is_demo from public.students order by nis;