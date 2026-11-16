-- 028: Pembagian semester di tahun ajaran. Jalankan hanya berkas ini; jangan jalankan ulang 001-027.
-- Kolom semester2_start = tanggal AWAL semester Genap. Semester Ganjil = awal tahun ajaran sampai sehari sebelumnya.
-- Kosong = memakai bawaan (1 Januari setelah tahun ajaran dimulai). Data lain tidak berubah.
alter table public.academic_years add column if not exists semester2_start date;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'academic_years_semester_split_chk') then
    alter table public.academic_years add constraint academic_years_semester_split_chk
      check (semester2_start is null or (semester2_start > start_date and semester2_start <= end_date));
  end if;
end $$;