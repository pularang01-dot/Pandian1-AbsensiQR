-- Menghapus data demo yang dibuat oleh demo_seed.sql. Data nyata tidak tersentuh (is_demo = false).
-- Catatan: siswa demo yang sudah memiliki catatan absensi tidak dapat dihapus (jejak audit dipertahankan);
-- ubah statusnya menjadi 'inactive' dari menu Siswa bila demikian.
delete from public.student_class_assignments where student_id in (select id from public.students where is_demo);
delete from public.students s where s.is_demo and not exists (select 1 from public.attendance_records r where r.student_id = s.id);
delete from public.classes c where c.name like 'DEMO %' and not exists (select 1 from public.student_class_assignments a where a.class_id = c.id);
