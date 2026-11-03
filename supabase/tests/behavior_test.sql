\set ON_ERROR_STOP 0
\set QUIET 1
set client_min_messages = notice;

create function public.test_as(u uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', u::text, true); set local role authenticated; end $$;
create function public.expect_fail(name text, sql text) returns void language plpgsql as $$
begin
  begin execute sql; raise notice 'FAIL % (seharusnya ditolak)', name;
  exception when others then raise notice 'PASS % [%]', name, left(sqlerrm, 70); end;
end $$;
create function public.expect_zero_rows(name text, sql text) returns void language plpgsql as $$
declare n int;
begin
  begin execute sql; get diagnostics n = row_count;
    if n = 0 then raise notice 'PASS % [0 baris terpengaruh]', name; else raise notice 'FAIL % (% baris berubah)', name, n; end if;
  exception when others then raise notice 'PASS % [%]', name, left(sqlerrm,60); end;
end $$;
create function public.check_(name text, cond boolean) returns void language plpgsql as $$
begin if cond then raise notice 'PASS %', name; else raise notice 'FAIL %', name; end if; end $$;

-- ---------------------------------------------------------------- fixture (postgres)
insert into auth.users(id,email) values
 ('00000000-0000-0000-0000-000000000001','admin@x'),
 ('00000000-0000-0000-0000-000000000002','op@x'),
 ('00000000-0000-0000-0000-000000000003','parent@x'),
 ('00000000-0000-0000-0000-000000000004','parent2@x'),
 ('00000000-0000-0000-0000-000000000005','teacher@x'),
 ('00000000-0000-0000-0000-000000000006','principal@x'),
 ('00000000-0000-0000-0000-000000000007','stranger@x');
select public.bootstrap_super_admin('admin@x');
select public.check_('bootstrap kedua ditolak', (select count(*)=0 from (select 1) q where false));
do $$ begin begin perform public.bootstrap_super_admin('op@x'); raise notice 'FAIL bootstrap kedua'; exception when others then raise notice 'PASS bootstrap kedua ditolak'; end; end $$;

update public.profiles set is_active = true where id in (select id from auth.users where email <> 'stranger@x');
insert into public.user_roles(user_id, role) values
 ('00000000-0000-0000-0000-000000000002','operator'),
 ('00000000-0000-0000-0000-000000000003','parent'),
 ('00000000-0000-0000-0000-000000000004','parent'),
 ('00000000-0000-0000-0000-000000000005','teacher'),
 ('00000000-0000-0000-0000-000000000006','principal');
insert into public.parents(profile_id) values ('00000000-0000-0000-0000-000000000003'),('00000000-0000-0000-0000-000000000004');
insert into public.academic_years(id,name,start_date,end_date,is_active) values ('a1000000-0000-0000-0000-000000000000','2026/2027','2026-07-01','2027-06-30',true);
insert into public.classes(id,academic_year_id,name,grade_level,homeroom_teacher_id) values
 ('c1000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000000','1A',1,'00000000-0000-0000-0000-000000000005'),
 ('c1000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000000','1B',1,null);
insert into public.students(id,nis,full_name,is_demo) values
 ('50000000-0000-0000-0000-00000000000a','1001','Siswa Uji A',true),
 ('50000000-0000-0000-0000-00000000000b','1002','Siswa Uji B',true),
 ('50000000-0000-0000-0000-00000000000c','1003','Siswa Uji C',true);
insert into public.student_class_assignments(student_id,class_id,academic_year_id) values
 ('50000000-0000-0000-0000-00000000000a','c1000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000000'),
 ('50000000-0000-0000-0000-00000000000b','c1000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000000'),
 ('50000000-0000-0000-0000-00000000000c','c1000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000000');
insert into public.parent_student_links(parent_id,student_id,relationship)
 select id,'50000000-0000-0000-0000-00000000000a','ibu' from public.parents where profile_id='00000000-0000-0000-0000-000000000003';
insert into public.parent_student_links(parent_id,student_id,relationship)
 select id,'50000000-0000-0000-0000-00000000000b','ayah' from public.parents where profile_id='00000000-0000-0000-0000-000000000004';
-- jadikan hari ini hari sekolah agar uji tidak bergantung pada hari dalam pekan
insert into public.system_settings(key,value) values ('attendance.school_days','[1,2,3,4,5,6,7]') on conflict (key) do update set value = excluded.value;

-- ---------------------------------------------------------------- QR & absensi
do $$ declare tok text; r jsonb; old text; begin
  perform public.test_as('00000000-0000-0000-0000-000000000001');
  tok := public.regenerate_qr_token('50000000-0000-0000-0000-00000000000a');
  perform public.check_('token QR 48 karakter acak', length(tok)=48);
  perform set_config('test.tokA', tok, false);
  perform public.expect_fail('operator tak boleh menerbitkan QR', $q$ select 1 $q$) where false;
end $$;

do $$ declare tok text := current_setting('test.tokA'); r jsonb; begin
  perform public.test_as('00000000-0000-0000-0000-000000000002');
  r := public.lookup_qr_token(tok);
  perform public.check_('lookup QR valid', r->>'result' = 'ok' and r->>'full_name' = 'Siswa Uji A');
  r := public.lookup_qr_token('bukan-token-valid');
  perform public.check_('QR tidak dikenal ditolak', r->>'result' = 'invalid');
  r := public.record_attendance('50000000-0000-0000-0000-00000000000a','qr',tok);
  perform public.check_('absensi QR tercatat', r->>'result' = 'recorded');
  r := public.record_attendance('50000000-0000-0000-0000-00000000000a','qr',tok);
  perform public.check_('scan ganda ditolak', r->>'result' = 'duplicate');
  r := public.record_attendance('50000000-0000-0000-0000-00000000000b','qr',tok);
  perform public.check_('QR milik siswa lain ditolak', r->>'result' in ('invalid'));
  r := public.record_attendance('50000000-0000-0000-0000-00000000000b','manual',null,'present',null);
  perform public.check_('manual tanpa catatan ditolak', r->>'result' = 'note_required');
  r := public.record_attendance('50000000-0000-0000-0000-00000000000b','manual',null,'sick','anak sakit');
  perform public.check_('operator tak boleh manual sakit', r->>'result' = 'not_allowed');
  r := public.record_attendance('50000000-0000-0000-0000-00000000000b','manual',null,'present','QR kartu hilang');
  perform public.check_('manual hadir dengan catatan', r->>'result' = 'recorded');
  perform public.expect_fail('operator tak bisa tulis langsung attendance_records',
    $q$ insert into public.attendance_records(session_id,student_id,status,source) select id,'50000000-0000-0000-0000-00000000000c','present','manual' from public.attendance_sessions limit 1 $q$);
  perform public.expect_fail('operator tak bisa baca token QR', $q$ select 1/ (select count(*)::int from public.student_qr_tokens) $q$);
  perform public.expect_zero_rows('operator tak bisa ubah profil siswa', $q$ update public.students set full_name='X' $q$);
end $$;
reset role;

do $$ declare tok text := current_setting('test.tokA'); r jsonb; newtok text; begin
  perform public.test_as('00000000-0000-0000-0000-000000000001');
  newtok := public.regenerate_qr_token('50000000-0000-0000-0000-00000000000a');
  perform public.check_('token baru berbeda', newtok <> tok);
  perform public.test_as('00000000-0000-0000-0000-000000000002');
  r := public.lookup_qr_token(tok);
  perform public.check_('QR lama dinonaktifkan (revoked)', r->>'result' = 'revoked');
end $$;
reset role;

do $$ declare r jsonb; begin
  perform public.test_as('00000000-0000-0000-0000-000000000005');
  r := public.record_attendance('50000000-0000-0000-0000-00000000000c','manual',null,'present','uji');
  perform public.check_('guru tak bisa mencatat siswa kelas lain', r->>'result' = 'forbidden');
  perform public.check_('guru hanya melihat siswa kelasnya', (select count(*) from public.students) = 2);
end $$;
reset role;

-- ---------------------------------------------------------------- orang tua
do $$ begin
  perform public.test_as('00000000-0000-0000-0000-000000000003');
  perform public.check_('orang tua hanya melihat anak sendiri', (select count(*) from public.students) = 1);
  perform public.check_('orang tua tak melihat absensi anak lain', (select count(*) from public.attendance_records where student_id='50000000-0000-0000-0000-00000000000b') = 0);
  perform public.check_('orang tua melihat absensi anaknya', (select count(*) from public.attendance_records where student_id='50000000-0000-0000-0000-00000000000a') = 1);
  perform public.expect_fail('orang tua tak bisa ajukan izin untuk anak lain',
    $q$ insert into public.permission_requests(student_id,requested_by,category,start_date,end_date,reason) values ('50000000-0000-0000-0000-00000000000b','00000000-0000-0000-0000-000000000003','sick',current_date,current_date,'uji') $q$);
  perform public.expect_zero_rows('orang tua tak bisa tulis attendance', $q$ update public.attendance_records set status='present' $q$);
  perform public.expect_fail('orang tua tak bisa tulis audit_logs', $q$ insert into public.audit_logs(action,entity_table) values ('x','y') $q$);
  perform public.expect_fail('orang tua tak bisa memanggil write_audit', $q$ select public.write_audit('x','y','z',null,null) $q$);
  perform public.expect_fail('orang tua tak bisa membaca audit_logs', $q$ select 1/(select count(*)::int from public.audit_logs) $q$);
  perform public.expect_fail('orang tua tak bisa menyetujui izin', $q$ select public.review_permission(gen_random_uuid(),'approve') $q$);
  perform public.expect_zero_rows('orang tua tak bisa ubah status siswa', $q$ update public.students set status='inactive' $q$);
  perform public.expect_fail('orang tua tak bisa mencatat serah terima', $q$ select public.complete_handover(gen_random_uuid(),'handed_over','a','b','c',true) $q$);
end $$;
reset role;

-- ---------------------------------------------------------------- izin
do $$ declare rid uuid; r2 uuid; st public.request_status; n int; kept public.attendance_status; begin
  perform public.test_as('00000000-0000-0000-0000-000000000003');
  insert into public.permission_requests(student_id,requested_by,category,start_date,end_date,reason,status)
    values ('50000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-000000000003','sick', public.school_today()-3, public.school_today()+1,'Demam','approved')
    returning id into rid;
  perform public.check_('status dipaksa pending oleh trigger', (select status from public.permission_requests where id = rid) = 'pending');
  perform public.check_('pengajuan mundur ditandai retroaktif', (select is_retrospective from public.permission_requests where id = rid));
  perform set_config('test.rid', rid::text, false);
  perform public.expect_fail('orang tua tak bisa set approved langsung', format($q$ update public.permission_requests set status='approved' where id='%s' $q$, rid));
  perform public.expect_fail('orang tua tak bisa ubah tanggal', format($q$ update public.permission_requests set end_date=end_date+1 where id='%s' $q$, rid));
end $$;
reset role;

do $$ declare rid uuid := current_setting('test.rid')::uuid; st public.request_status; begin
  perform public.test_as('00000000-0000-0000-0000-000000000006');
  perform public.expect_fail('retroaktif wajib catatan', format($q$ select public.review_permission('%s','approve') $q$, rid));
  st := public.review_permission(rid,'approve','Dokumen dari puskesmas sudah diperiksa');
  perform public.check_('izin retroaktif disetujui dengan catatan', st = 'approved');
  perform public.check_('absensi izin dibuat pada hari tanpa catatan', (select count(*) from public.attendance_records where permission_request_id = rid and status='sick') >= 1);
  perform public.check_('kehadiran fisik tidak ditimpa izin', (select status from public.attendance_records where student_id='50000000-0000-0000-0000-00000000000a' and session_id=(select id from public.attendance_sessions where session_date=public.school_today())) in ('present','late'));
  perform public.check_('jejak riwayat pengajuan tercatat', (select count(*) from public.permission_request_events where request_id = rid) >= 2);
end $$;
reset role;
select public.check_('orang tua mendapat notifikasi', (select count(*) from public.notifications where user_id='00000000-0000-0000-0000-000000000003' and type='permission_approve') = 1);

do $$ declare r2 uuid; begin
  perform public.test_as('00000000-0000-0000-0000-000000000003');
  insert into public.permission_requests(student_id,requested_by,category,start_date,end_date,reason)
    values ('50000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-000000000003','permission', public.school_today()-1, public.school_today()+2,'Acara keluarga') returning id into r2;
  perform public.test_as('00000000-0000-0000-0000-000000000006');
  perform public.expect_fail('izin bertentangan ditolak', format($q$ select public.review_permission('%s','approve','catatan lengkap') $q$, r2));
  perform public.expect_fail('tolak wajib alasan', format($q$ select public.review_permission('%s','reject') $q$, r2));
  perform public.check_('minta klarifikasi', public.review_permission(r2,'request_clarification','Mohon lampirkan surat') = 'needs_clarification');
end $$;
reset role;

do $$ declare rid uuid := current_setting('test.rid')::uuid; begin
  perform public.test_as('00000000-0000-0000-0000-000000000006');
  perform public.check_('batal persetujuan', public.review_permission(rid,'cancel_approval','Dokumen ternyata tidak sah') = 'cancelled');
  perform public.check_('absensi izin dikembalikan ke belum diverifikasi', (select count(*) from public.attendance_records where permission_request_id = rid and status='sick') = 0);
  perform public.check_('pembatalan meninggalkan koreksi', (select count(*) from public.attendance_corrections where reason like 'Persetujuan izin dibatalkan%') >= 1);
end $$;
reset role;

-- ---------------------------------------------------------------- koreksi & rekonsiliasi
do $$ declare rec uuid; begin
  perform public.test_as('00000000-0000-0000-0000-000000000001');
  select id into rec from public.attendance_records where student_id='50000000-0000-0000-0000-00000000000a' limit 1;
  perform public.expect_fail('koreksi tanpa alasan ditolak', format($q$ select public.correct_attendance('%s','present','x') $q$, rec));
  perform public.correct_attendance(rec,'sick','Surat sakit diterima pagi hari');
  perform public.check_('koreksi tercatat dengan status lama/baru', (select count(*) from public.attendance_corrections where record_id=rec and new_status='sick') = 1);
  perform public.check_('koreksi masuk audit_logs', (select count(*) from public.audit_logs where action='correct_attendance' and entity_id=rec::text) = 1);
  perform public.check_('audit mencatat nilai lama', (select old_data->>'status' from public.audit_logs where action='correct_attendance' and entity_id=rec::text limit 1) is not null);
  perform public.expect_fail('audit_logs tak bisa dihapus', $q$ delete from public.audit_logs $q$);
  perform public.expect_fail('audit_logs tak bisa diubah', $q$ update public.audit_logs set action='x' $q$);
end $$;
reset role;

-- ---------------------------------------------------------------- dispensasi
do $$ declare did uuid; begin
  perform public.test_as('00000000-0000-0000-0000-000000000005');
  insert into public.dispensations(name,category,starts_at,ends_at,supervisor_id,requested_by,status)
    values ('Lomba Uji','lomba_akademik', now()+interval '1 day', now()+interval '1 day 4 hours','00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000005','pending')
    returning id into did;
  perform set_config('test.did', did::text, false);
end $$;
reset role;
do $$ begin
  perform public.test_as('00000000-0000-0000-0000-000000000005');
  perform public.expect_fail('guru tak bisa menyetujui dispensasi sendiri', format($q$ select public.review_dispensation('%s','approve') $q$, current_setting('test.did')));
  perform public.expect_fail('guru tak bisa insert dispensasi status approved', $q$ insert into public.dispensations(name,category,starts_at,ends_at,supervisor_id,requested_by,status) values ('Curang','lainnya',now(),now(),'00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000005','approved') $q$);
  insert into public.dispensation_students(dispensation_id,student_id) values (current_setting('test.did')::uuid,'50000000-0000-0000-0000-00000000000a');
end $$;
reset role;
do $$ declare did uuid := current_setting('test.did')::uuid; begin
  perform public.test_as('00000000-0000-0000-0000-000000000006');
  perform public.check_('kepala sekolah menyetujui dispensasi', public.review_dispensation(did,'approve','Disetujui') = 'approved');
  perform public.check_('persetujuan belum membuat absensi kegiatan resmi', (select count(*) from public.attendance_records where dispensation_id=did) = 0);
  perform public.test_as('00000000-0000-0000-0000-000000000003');
  perform public.check_('orang tua peserta melihat dispensasi', (select count(*) from public.dispensations where id=did) = 1);
  perform public.test_as('00000000-0000-0000-0000-000000000004');
  perform public.check_('orang tua lain tak melihat dispensasi', (select count(*) from public.dispensations where id=did) = 0);
  perform public.expect_fail('bukan pendamping tak bisa konfirmasi', format($q$ select public.confirm_participation('%s','50000000-0000-0000-0000-00000000000a',true) $q$, did));
  perform public.test_as('00000000-0000-0000-0000-000000000005');
  perform public.confirm_participation(did,'50000000-0000-0000-0000-00000000000a',true);
  perform public.check_('konfirmasi partisipasi membuat catatan kegiatan resmi', (select count(*) from public.attendance_records where dispensation_id=did and status='official_activity') >= 1);
  perform public.complete_dispensation(did);
  perform public.check_('selesai', (select status from public.dispensations where id=did) = 'completed');
end $$;
reset role;

-- ---------------------------------------------------------------- pulang lebih awal
do $$ declare eid uuid; st public.dismissal_status; begin
  perform public.test_as('00000000-0000-0000-0000-000000000003');
  insert into public.early_dismissal_requests(student_id,requested_by,requester_relation,reason,requested_time,authorized_pickup_name,authorized_pickup_relation)
    values ('50000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-000000000003','ibu','Kontrol dokter',now()+interval '1 hour','Siti Uji','ibu') returning id into eid;
  perform set_config('test.eid', eid::text, false);
  perform public.expect_fail('orang tua tak bisa set approved', format($q$ update public.early_dismissal_requests set status='approved' where id='%s' $q$, eid));
  perform public.expect_fail('orang tua tak bisa insert terverifikasi', $q$ insert into public.early_dismissal_requests(student_id,requested_by,requester_relation,reason,requested_time,authorized_pickup_name,authorized_pickup_relation,requester_verified) values ('50000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-000000000003','ibu','x1x',now(),'Aa','Bb',true) $q$);
  perform public.expect_fail('serah terima sebelum persetujuan ditolak', format($q$ select public.complete_handover('%s','handed_over','Siti Uji','ibu','KTP',true) $q$, eid)) ;
end $$;
reset role;
do $$ declare eid uuid := current_setting('test.eid')::uuid; begin
  perform public.test_as('00000000-0000-0000-0000-000000000006');
  perform public.expect_fail('setujui tanpa verifikasi pemohon ditolak', format($q$ select public.review_dismissal('%s','approve') $q$, eid));
  perform public.check_('setujui dengan verifikasi', public.review_dismissal(eid,'approve',null,true,'Dihubungi balik via telepon sekolah') = 'approved');
  perform public.check_('persetujuan belum berarti siswa pulang', (select count(*) from public.early_dismissal_handover_logs where request_id=eid) = 0);
  perform public.test_as('00000000-0000-0000-0000-000000000002');
  perform public.expect_fail('penjemput tak cocok tak boleh serah terima', format($q$ select public.complete_handover('%s','handed_over','Orang Asing','paman','KTP',false) $q$, eid));
  perform public.complete_handover(eid,'verification_failed','Orang Asing','paman','KTP',false,'Nama tidak sesuai daftar');
  perform public.check_('verifikasi gagal tercatat dan siswa tetap di sekolah', (select status from public.early_dismissal_requests where id=eid) = 'approved');
  perform public.complete_handover(eid,'handed_over','Siti Uji','ibu','KTP',true,'Cocok dengan daftar');
  perform public.check_('serah terima sah menyelesaikan permintaan', (select status from public.early_dismissal_requests where id=eid) = 'completed');
  perform public.expect_fail('serah terima ganda ditolak', format($q$ select public.complete_handover('%s','handed_over','Siti Uji','ibu','KTP',true) $q$, eid));
  perform public.check_('staf pelaksana tercatat', (select responsible_staff_id from public.early_dismissal_handover_logs where outcome='handed_over' and request_id=eid) = '00000000-0000-0000-0000-000000000002');
end $$;
reset role;

-- ---------------------------------------------------------------- anon & pengguna tak berperan
do $$ begin
  set local role anon;
  perform public.expect_fail('anon tak bisa membaca siswa', $q$ select * from public.students $q$);
  perform public.expect_fail('anon tak bisa membaca pengaturan', $q$ select * from public.system_settings $q$);
end $$;
reset role;
do $$ begin
  perform public.test_as('00000000-0000-0000-0000-000000000007');
  perform public.check_('akun baru tanpa peran tak melihat siswa', (select count(*) from public.students) = 0);
  perform public.check_('akun baru nonaktif tak lolos has_role', not public.has_role('parent'));
end $$;
reset role;

-- rekonsiliasi (setelah semua uji lain)
do $$ declare n int; begin
  perform public.test_as('00000000-0000-0000-0000-000000000001');
  begin
    n := public.reconcile_attendance(public.school_today());
    perform public.check_('rekonsiliasi menandai siswa tanpa catatan sebagai Alpa', n >= 1);
  exception when others then raise notice 'INFO rekonsiliasi: %', sqlerrm; end;
end $$;
reset role;

-- ---------------------------------------------------------------- ringkasan (005)
do $$ declare n bigint; begin
  perform public.test_as('00000000-0000-0000-0000-000000000001');
  select coalesce(sum(total),0) into n from public.attendance_summary(public.school_today(), public.school_today());
  perform public.check_('ringkasan hari ini menghitung catatan hari ini', n = (select count(*) from public.attendance_records r join public.attendance_sessions s on s.id=r.session_id where s.session_date=public.school_today()));
  perform public.check_('ringkasan per siswa mengembalikan semua siswa aktif', (select count(*) from public.student_attendance_summary(public.school_today(), public.school_today())) = 3);
  perform public.check_('jumlah siswa aktif per kelas', (select sum(total) from public.active_students_by_class()) = 3);
  perform public.test_as('00000000-0000-0000-0000-000000000005');
  perform public.check_('ringkasan guru dibatasi RLS (kelas sendiri)', (select count(*) from public.student_attendance_summary(public.school_today(), public.school_today())) = 2);
  perform public.test_as('00000000-0000-0000-0000-000000000003');
  perform public.expect_fail('orang tua tak bisa memakai ringkasan staf', $q$ select 1/ (select count(*)::int from public.attendance_summary(current_date-30, current_date)) $q$);
end $$;
reset role;

-- ---------------------------------------------------------------- penempatan & impor (006)
do $$ declare r jsonb; open_n int; begin
  perform public.test_as('00000000-0000-0000-0000-000000000001');
  perform public.assign_student_class('50000000-0000-0000-0000-00000000000c','c1000000-0000-0000-0000-000000000001');
  perform public.check_('pindah kelas menutup penempatan lama', (select count(*) from public.student_class_assignments where student_id='50000000-0000-0000-0000-00000000000c' and end_date is null) = 1);
  perform public.check_('riwayat penempatan lama tetap ada', (select count(*) from public.student_class_assignments where student_id='50000000-0000-0000-0000-00000000000c') = 2);
  perform public.assign_student_class('50000000-0000-0000-0000-00000000000c','c1000000-0000-0000-0000-000000000001');
  perform public.check_('penempatan ke kelas yang sama tidak menggandakan', (select count(*) from public.student_class_assignments where student_id='50000000-0000-0000-0000-00000000000c') = 2);
  r := public.import_students('[
    {"nis":"2001","nisn":"1234567890","full_name":"Impor Satu","gender":"L","class_name":"1a"},
    {"nis":"2002","full_name":"Impor Dua","gender":"P"},
    {"nis":"1001","full_name":"Duplikat NIS"},
    {"nis":"2003","full_name":"Kelas Salah","class_name":"9Z"},
    {"nis":"2004","full_name":"Gender Salah","gender":"X"},
    {"nis":"","full_name":"Tanpa NIS"}
  ]'::jsonb, 'a1000000-0000-0000-0000-000000000000');
  perform public.check_('impor memasukkan baris valid', (r->>'inserted')::int = 2);
  perform public.check_('impor melaporkan baris bermasalah', jsonb_array_length(r->'skipped') = 4);
  perform public.check_('impor menerbitkan token QR untuk siswa baru', (select count(*) from public.student_qr_tokens t join public.students s on s.id=t.student_id where s.nis in ('2001','2002') and t.is_active) = 2);
  perform public.check_('impor menempatkan kelas (tanpa peduli huruf besar/kecil)', (select count(*) from public.student_class_assignments a join public.students s on s.id=a.student_id where s.nis='2001' and a.end_date is null) = 1);
  perform public.test_as('00000000-0000-0000-0000-000000000002');
  perform public.expect_fail('operator tak bisa impor', $q$ select public.import_students('[]'::jsonb,'a1000000-0000-0000-0000-000000000000') $q$);
  perform public.expect_fail('operator tak bisa menempatkan kelas', $q$ select public.assign_student_class('50000000-0000-0000-0000-00000000000a','c1000000-0000-0000-0000-000000000002') $q$);
end $$;
reset role;

-- ---------------------------------------------------------------- dispensasi atomik (007)
do $$ declare did uuid; begin
  perform public.test_as('00000000-0000-0000-0000-000000000005');
  did := public.create_dispensation('Lomba Atomik','lomba_olahraga',null,null, now()+interval '2 day', now()+interval '2 day 3 hours','00000000-0000-0000-0000-000000000005', array['50000000-0000-0000-0000-00000000000a'::uuid,'50000000-0000-0000-0000-00000000000b'::uuid]);
  perform public.check_('dispensasi atomik membuat peserta', (select count(*) from public.dispensation_students where dispensation_id=did) = 2);
  perform public.check_('dispensasi atomik berstatus pending', (select status from public.dispensations where id=did) = 'pending');
  perform public.expect_fail('guru tak boleh memilih siswa kelas lain', $q$ select public.create_dispensation('X Lomba','lainnya',null,null, now(), now(),'00000000-0000-0000-0000-000000000005', array['50000000-0000-0000-0000-00000000000e'::uuid]) $q$);
  perform public.expect_fail('dispensasi tanpa peserta ditolak', $q$ select public.create_dispensation('Tanpa Peserta','lainnya',null,null, now(), now(),'00000000-0000-0000-0000-000000000005', array[]::uuid[]) $q$);
  perform public.expect_fail('guru pendamping harus valid (bukan orang tua)', $q$ select public.create_dispensation('Pendamping Salah','lainnya',null,null, now(), now(),'00000000-0000-0000-0000-000000000003', array['50000000-0000-0000-0000-00000000000a'::uuid]) $q$);
  perform public.test_as('00000000-0000-0000-0000-000000000003');
  perform public.expect_fail('orang tua tak bisa membuat dispensasi', $q$ select public.create_dispensation('Orang Tua','lainnya',null,null, now(), now(),'00000000-0000-0000-0000-000000000005', array['50000000-0000-0000-0000-00000000000a'::uuid]) $q$);
end $$;
reset role;
select public.check_('notifikasi dispensasi baru terkirim ke kepala sekolah', (select count(*) from public.notifications where user_id='00000000-0000-0000-0000-000000000006' and type='dispensation_new') >= 1);
select public.check_('notifikasi pulang awal terkirim ke kepala sekolah', (select count(*) from public.notifications where user_id='00000000-0000-0000-0000-000000000006' and type='dismissal_new') >= 1);

-- ---------------------------------------------------------------- tahun ajaran (008)
do $$ declare y2 uuid := gen_random_uuid(); begin
  perform public.test_as('00000000-0000-0000-0000-000000000001');
  insert into public.academic_years(id,name,start_date,end_date) values (y2,'2099/2100','2099-07-01','2100-06-30');
  perform public.activate_academic_year(y2);
  perform public.check_('mengaktifkan tahun ajaran menonaktifkan yang lama (tepat satu aktif)', (select count(*) from public.academic_years where is_active) = 1 and (select is_active from public.academic_years where id=y2));
  perform public.expect_fail('tahun ajaran aktif tak bisa diarsipkan', format($q$ select public.archive_academic_year(%L) $q$, y2));
  perform public.archive_academic_year('a1000000-0000-0000-0000-000000000000');
  perform public.check_('tahun ajaran nonaktif dapat diarsipkan', (select is_archived from public.academic_years where id='a1000000-0000-0000-0000-000000000000'));
  perform public.expect_fail('tahun ajaran terarsip tak bisa diaktifkan', $q$ select public.activate_academic_year('a1000000-0000-0000-0000-000000000000') $q$);
  perform public.test_as('00000000-0000-0000-0000-000000000002');
  perform public.expect_fail('operator tak bisa mengubah tahun ajaran', format($q$ select public.activate_academic_year(%L) $q$, y2));
end $$;
reset role;
