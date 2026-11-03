-- PANDIAN SMART ATTENDANCE - DATA DEMO (OPSIONAL)
-- =============================================================================
-- PERINGATAN: berkas ini HANYA untuk demonstrasi/pelatihan. JANGAN dijalankan di
-- basis data produksi. Tidak dijalankan otomatis oleh migrasi.
-- Semua siswa fiktif, bernama "Demo ..." dan bertanda is_demo = true.
-- Prasyarat: migrasi 001-008 sudah diterapkan dan ada satu tahun ajaran AKTIF
-- (buat lewat Pengaturan > Tahun ajaran, atau SQL Editor).
-- Menghapus data demo: jalankan supabase/seed/demo_cleanup.sql
-- =============================================================================
do $$
declare y uuid; c1 uuid; c2 uuid; sid uuid; i int; cls uuid;
begin
  select id into y from public.academic_years where is_active;
  if y is null then raise exception 'Buat dan aktifkan tahun ajaran terlebih dahulu.'; end if;

  insert into public.classes(academic_year_id, name, grade_level) values (y, 'DEMO 1A', 1)
    on conflict (academic_year_id, name) do nothing;
  insert into public.classes(academic_year_id, name, grade_level) values (y, 'DEMO 1B', 1)
    on conflict (academic_year_id, name) do nothing;
  select id into c1 from public.classes where academic_year_id = y and name = 'DEMO 1A';
  select id into c2 from public.classes where academic_year_id = y and name = 'DEMO 1B';

  for i in 1..8 loop
    insert into public.students(nis, full_name, gender, is_demo)
    values ('DEMO' || lpad(i::text, 3, '0'), 'Demo Siswa ' || i, case when i % 2 = 0 then 'P' else 'L' end, true)
    on conflict (nis) do nothing
    returning id into sid;
    if sid is null then continue; end if;
    cls := case when i <= 4 then c1 else c2 end;
    insert into public.student_class_assignments(student_id, class_id, academic_year_id) values (sid, cls, y);
    insert into public.student_qr_tokens(student_id, token) values (sid, encode(gen_random_bytes(24), 'hex'));
  end loop;
end $$;
