-- PANDIAN SMART ATTENDANCE - ALAT KHUSUS PEMILIK PROYEK (jalankan di Supabase > SQL Editor)
-- LANGKAH 2 dari 2: HAPUS PERMANEN siswa yang tampil di langkah 1, BESERTA seluruh riwayatnya
-- (absensi dan koreksinya, izin/sakit, dispensasi, pulang awal, penempatan kelas, tautan orang tua, QR).
--
-- TIDAK DAPAT DIBATALKAN. Jalankan langkah 1 dulu dan pastikan daftarnya benar.
-- Alat ini tidak mengubah aplikasi maupun migrasi. Hanya Anda (pemilik proyek Supabase) yang dapat menjalankannya;
-- pengguna aplikasi tidak memiliki jalur ini. Penghapusan dicatat di audit log.
--
-- Pengaman: ganti '' pada kata_konfirmasi menjadi 'HAPUS' agar berjalan. Bila tidak, berkas ini menolak dan tidak mengubah apa pun.
do $$
declare
  kata_konfirmasi text   := '';                    -- <== ketik HAPUS di dalam tanda kutip
  nis_tambahan    text[] := array[]::text[];       -- <== samakan dengan langkah 1
  ids uuid[]; disp uuid[]; n_students int; n_att int; n_perm int; n_dis int; n_docs int; n_disp int;
begin
  if kata_konfirmasi <> 'HAPUS' then
    raise exception 'Dibatalkan: ketik HAPUS pada kata_konfirmasi untuk melanjutkan. Tidak ada data yang diubah.';
  end if;

  select coalesce(array_agg(id), array[]::uuid[]) into ids from public.students where is_demo or nis = any(nis_tambahan);
  n_students := coalesce(array_length(ids, 1), 0);
  if n_students = 0 then raise exception 'Tidak ada siswa yang cocok. Tidak ada data yang diubah.'; end if;

  -- Dispensasi yang terdampak (dihapus bila akhirnya tidak punya siswa lagi).
  select coalesce(array_agg(distinct dispensation_id), array[]::uuid[]) into disp from public.dispensation_students where student_id = any(ids);

  select count(*) into n_docs from public.permission_documents d join public.permission_requests p on p.id = d.request_id where p.student_id = any(ids);

  -- Urutan penting: catatan absensi merujuk izin dan dispensasi, jadi dihapus lebih dulu.
  delete from public.attendance_corrections where record_id in (select id from public.attendance_records where student_id = any(ids));
  delete from public.attendance_records where student_id = any(ids);                        get diagnostics n_att = row_count;
  delete from public.early_dismissal_handover_logs where request_id in (select id from public.early_dismissal_requests where student_id = any(ids));
  delete from public.early_dismissal_requests where student_id = any(ids);                  get diagnostics n_dis = row_count;
  delete from public.permission_requests where student_id = any(ids);                       get diagnostics n_perm = row_count;  -- dokumen dan peristiwa ikut terhapus
  delete from public.dispensation_students where student_id = any(ids);
  delete from public.dispensations x where x.id = any(disp) and not exists (select 1 from public.dispensation_students s where s.dispensation_id = x.id);
  get diagnostics n_disp = row_count;
  delete from public.student_class_assignments where student_id = any(ids);
  delete from public.students where id = any(ids);                                          -- tautan orang tua dan token QR ikut terhapus

  insert into public.audit_logs(actor_id, action, entity_table, entity_id, new_data)
  values (null, 'manual_delete_students', 'students', null,
          jsonb_build_object('students', n_students, 'attendance_records', n_att, 'permission_requests', n_perm,
                             'dismissal_requests', n_dis, 'dispensations_removed', n_disp, 'via', 'sql_editor'));

  raise notice 'Selesai: % siswa, % catatan absensi, % izin/sakit, % pulang awal, % dispensasi kosong dihapus.', n_students, n_att, n_perm, n_dis, n_disp;
  if n_docs > 0 then
    raise notice 'PERHATIAN: % dokumen izin dihapus dari basis data. Berkas aslinya masih ada di Storage > permission-documents; hapus manual lewat dashboard bila perlu.', n_docs;
  end if;
end $$;

-- Opsional setelah itu: hapus kelas contoh yang kosong (nama diawali DEMO).
-- delete from public.classes c where c.name like 'DEMO %' and not exists (select 1 from public.student_class_assignments a where a.class_id = c.id);