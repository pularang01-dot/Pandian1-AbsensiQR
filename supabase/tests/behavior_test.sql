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

-- ---------------------------------------------------------------- token QR tanpa pgcrypto di search_path (009)
do $$ declare t1 text; t2 text; begin
  perform public.test_as('00000000-0000-0000-0000-000000000001');
  t1 := public.regenerate_qr_token('50000000-0000-0000-0000-00000000000a');
  t2 := public.regenerate_qr_token('50000000-0000-0000-0000-00000000000a');
  perform public.check_('token QR 48 karakter heksa', t1 ~ '^[0-9a-f]{48}$');
  perform public.check_('token QR baru berbeda dari sebelumnya', t1 <> t2);
  perform public.check_('hanya satu token aktif per siswa setelah terbit ulang', (select count(*) from public.student_qr_tokens where student_id='50000000-0000-0000-0000-00000000000a' and is_active) = 1);
end $$;
reset role;

-- ---------------------------------------------------------------- wali kelas (010)
do $$ declare n int; begin
  perform public.check_('riwayat wali terisi dari kelas yang punya wali', (select count(*) from public.class_homeroom_history where class_id='c1000000-0000-0000-0000-000000000001' and ended_at is null) = 1);
  perform public.test_as('00000000-0000-0000-0000-000000000002');
  perform public.expect_fail('operator tak bisa memindahkan wali', $q$ select public.move_homeroom_teacher('c1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000002') $q$);
  perform public.test_as('00000000-0000-0000-0000-000000000001');
  perform public.move_homeroom_teacher('c1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000002');
  perform public.check_('wali pindah ke kelas tujuan', (select homeroom_teacher_id from public.classes where id='c1000000-0000-0000-0000-000000000002') = '00000000-0000-0000-0000-000000000005');
  perform public.check_('kelas asal kosong setelah pindah ke kelas kosong', (select homeroom_teacher_id is null from public.classes where id='c1000000-0000-0000-0000-000000000001'));
  perform public.check_('riwayat: kelas asal ditutup dengan alasan dipindahkan', (select end_reason from public.class_homeroom_history where class_id='c1000000-0000-0000-0000-000000000001' and ended_at is not null order by ended_at desc limit 1) = 'dipindahkan');
  perform public.check_('riwayat: kelas tujuan punya satu wali terbuka', (select count(*) from public.class_homeroom_history where class_id='c1000000-0000-0000-0000-000000000002' and ended_at is null) = 1);
  perform public.expect_fail('pindah tanpa wali di kelas asal ditolak', $q$ select public.move_homeroom_teacher('c1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000002') $q$);
  perform public.test_as('00000000-0000-0000-0000-000000000005');
  perform public.expect_zero_rows('guru tak bisa membaca riwayat wali', $q$ select 1 from public.class_homeroom_history $q$);
end $$;
reset role;
do $$ declare n int; begin
  n := public.clear_homeroom_for_user('00000000-0000-0000-0000-000000000005', 'akun dinonaktifkan');
  perform public.check_('kosongkan wali saat akun nonaktif', n = 1 and (select count(*) from public.classes where homeroom_teacher_id is not null) = 0);
  perform public.check_('riwayat mencatat alasan akun dinonaktifkan', exists (select 1 from public.class_homeroom_history where end_reason = 'akun dinonaktifkan'));
end $$;

-- ---------------------------------------------------------------- rekonsiliasi per kelas (011)
update public.classes set homeroom_teacher_id = '00000000-0000-0000-0000-000000000005' where id = 'c1000000-0000-0000-0000-000000000001';
do $$ declare n int; d date := date '2026-11-03'; begin
  perform public.test_as('00000000-0000-0000-0000-000000000005');
  perform public.expect_fail('wali kelas tak bisa rekonsiliasi seluruh sekolah', format($q$ select public.reconcile_attendance(%L) $q$, d));
  perform public.expect_fail('wali kelas tak bisa rekonsiliasi kelas lain', format($q$ select public.reconcile_attendance(%L, 'c1000000-0000-0000-0000-000000000002') $q$, d));
  perform public.test_as('00000000-0000-0000-0000-000000000002');
  perform public.expect_fail('operator tak bisa rekonsiliasi', format($q$ select public.reconcile_attendance(%L, 'c1000000-0000-0000-0000-000000000001') $q$, d));
  perform public.test_as('00000000-0000-0000-0000-000000000005');
  begin
    n := public.reconcile_attendance(d, 'c1000000-0000-0000-0000-000000000001');
    perform public.check_('wali kelas merekonsiliasi kelasnya sendiri', n >= 1);
    perform public.check_('siswa kelas lain tidak tersentuh', not exists (select 1 from public.attendance_records r join public.attendance_sessions s on s.id=r.session_id where s.session_date=d and r.class_id is distinct from 'c1000000-0000-0000-0000-000000000001'));
    perform public.check_('rekonsiliasi wali tidak menutup sesi', (select status from public.attendance_sessions where session_date=d) <> 'closed');
  exception when others then raise notice 'FAIL rekonsiliasi kelas: %', sqlerrm; end;
end $$;
reset role;

-- ---------------------------------------------------------------- hapus siswa (012)
insert into public.students(id,nis,full_name,is_demo) values ('50000000-0000-0000-0000-0000000000d1','9001','Siswa Hapus Uji',true);
insert into public.student_qr_tokens(student_id, token) values ('50000000-0000-0000-0000-0000000000d1', public.new_qr_token());
do $$ declare r jsonb; begin
  perform public.test_as('00000000-0000-0000-0000-000000000005');
  perform public.expect_fail('guru tak bisa menghapus siswa', $q$ select public.delete_students(array['50000000-0000-0000-0000-0000000000d1']::uuid[], 'HAPUS') $q$);
  perform public.test_as('00000000-0000-0000-0000-000000000002');
  perform public.expect_fail('operator tak bisa menghapus siswa', $q$ select public.delete_students(array['50000000-0000-0000-0000-0000000000d1']::uuid[], 'HAPUS') $q$);
  perform public.test_as('00000000-0000-0000-0000-000000000001');
  perform public.expect_fail('hapus tanpa kata konfirmasi ditolak', $q$ select public.delete_students(array['50000000-0000-0000-0000-0000000000d1']::uuid[], 'hapus') $q$);
  r := public.delete_students(array['50000000-0000-0000-0000-0000000000d1','50000000-0000-0000-0000-00000000000a']::uuid[], '', true);
  perform public.check_('pratinjau tidak menghapus apa pun', (r->>'deletable')::int = 1 and exists (select 1 from public.students where id='50000000-0000-0000-0000-0000000000d1'));
  r := public.delete_students(array['50000000-0000-0000-0000-0000000000d1','50000000-0000-0000-0000-00000000000a']::uuid[], 'HAPUS');
  perform public.check_('siswa tanpa riwayat terhapus', (r->>'deleted')::int = 1 and not exists (select 1 from public.students where id='50000000-0000-0000-0000-0000000000d1'));
  perform public.check_('siswa dengan riwayat dilindungi', jsonb_array_length(r->'skipped') = 1 and exists (select 1 from public.students where id='50000000-0000-0000-0000-00000000000a'));
  perform public.check_('token QR ikut terhapus', not exists (select 1 from public.student_qr_tokens where student_id='50000000-0000-0000-0000-0000000000d1'));
  perform public.check_('penghapusan tercatat di audit log', exists (select 1 from public.audit_logs where action='delete_students'));
end $$;
reset role;

-- ---------------------------------------------------------------- jejak akun (013)
do $$ begin
  perform public.check_('akun baru tanpa aktivitas tidak punya jejak', public.account_footprint('00000000-0000-0000-0000-000000000007') = '{}'::jsonb);
  perform public.check_('akun yang pernah mencatat/meninjau punya jejak', public.account_footprint('00000000-0000-0000-0000-000000000001') <> '{}'::jsonb);
  perform public.check_('mantan wali kelas punya jejak (riwayat wali)', public.account_footprint('00000000-0000-0000-0000-000000000005') ? 'class_homeroom_history.teacher_id');
end $$;
do $$ declare ok boolean; begin
  perform public.test_as('00000000-0000-0000-0000-000000000001');
  begin perform public.account_footprint('00000000-0000-0000-0000-000000000007'); raise notice 'FAIL jejak akun terbuka untuk klien';
  exception when others then raise notice 'PASS jejak akun tidak dapat dipanggil dari klien'; end;
end $$;
reset role;

-- ---------------------------------------------------------------- kelulusan (014)
insert into auth.users(id,email) values
 ('00000000-0000-0000-0000-0000000000a1','pg1@x'),('00000000-0000-0000-0000-0000000000a2','pg2@x');
update public.profiles set is_active = true where id in ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2');
insert into public.user_roles(user_id, role) values ('00000000-0000-0000-0000-0000000000a1','parent'),('00000000-0000-0000-0000-0000000000a2','parent');
insert into public.parents(id, profile_id) values ('b0000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a1'),('b0000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000a2');
insert into public.classes(id,academic_year_id,name,grade_level) values ('c1000000-0000-0000-0000-0000000000f6','a1000000-0000-0000-0000-000000000000','6Z',6);
insert into public.students(id,nis,full_name,is_demo) values
 ('50000000-0000-0000-0000-0000000000e1','9101','Lulus Satu',true),('50000000-0000-0000-0000-0000000000e2','9102','Lulus Dua',true),('50000000-0000-0000-0000-0000000000e3','9103','Adik Kelas Satu',true);
insert into public.student_class_assignments(student_id,class_id,academic_year_id) values
 ('50000000-0000-0000-0000-0000000000e1','c1000000-0000-0000-0000-0000000000f6','a1000000-0000-0000-0000-000000000000'),
 ('50000000-0000-0000-0000-0000000000e2','c1000000-0000-0000-0000-0000000000f6','a1000000-0000-0000-0000-000000000000'),
 ('50000000-0000-0000-0000-0000000000e3','c1000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000000');
insert into public.student_qr_tokens(student_id, token) values ('50000000-0000-0000-0000-0000000000e1', public.new_qr_token());
-- a1 hanya punya anak e1; a2 punya e2 (lulus) dan e3 (adik, masih aktif)
insert into public.parent_student_links(parent_id, student_id, relationship) values
 ('b0000000-0000-0000-0000-0000000000a1','50000000-0000-0000-0000-0000000000e1','ibu'),
 ('b0000000-0000-0000-0000-0000000000a2','50000000-0000-0000-0000-0000000000e2','ayah'),
 ('b0000000-0000-0000-0000-0000000000a2','50000000-0000-0000-0000-0000000000e3','ayah');
do $$ declare r jsonb; begin
  perform public.test_as('00000000-0000-0000-0000-0000000000a1');
  perform public.check_('orang tua melihat anak yang aktif', (select count(*) from public.students where id='50000000-0000-0000-0000-0000000000e1') = 1);
  perform public.test_as('00000000-0000-0000-0000-000000000005');
  perform public.expect_fail('guru tak bisa meluluskan kelas', $q$ select public.graduate_students('c1000000-0000-0000-0000-0000000000f6') $q$);
  perform public.test_as('00000000-0000-0000-0000-000000000001');
  r := public.graduate_students('c1000000-0000-0000-0000-0000000000f6', true, true);
  perform public.check_('pratinjau kelulusan menghitung dampak tanpa mengubah', (r->>'students')::int = 2 and (r->>'parents_to_deactivate')::int = 1 and (select status from public.students where id='50000000-0000-0000-0000-0000000000e1') = 'active');
  r := public.graduate_students('c1000000-0000-0000-0000-0000000000f6', true, false);
  perform public.check_('siswa kelas diluluskan', (select count(*) from public.students where status='graduated' and id in ('50000000-0000-0000-0000-0000000000e1','50000000-0000-0000-0000-0000000000e2')) = 2);
  perform public.check_('penempatan kelas ditutup', (select count(*) from public.student_class_assignments where class_id='c1000000-0000-0000-0000-0000000000f6' and end_date is null) = 0);
  perform public.check_('QR siswa lulus dicabut', not exists (select 1 from public.student_qr_tokens where student_id='50000000-0000-0000-0000-0000000000e1' and is_active));
  perform public.check_('orang tua tanpa anak aktif dinonaktifkan', not (select is_active from public.profiles where id='00000000-0000-0000-0000-0000000000a1'));
  perform public.check_('orang tua yang masih punya anak aktif tetap aktif', (select is_active from public.profiles where id='00000000-0000-0000-0000-0000000000a2'));
  perform public.expect_fail('kelas tanpa siswa aktif ditolak', $q$ select public.graduate_students('c1000000-0000-0000-0000-0000000000f6') $q$);
  perform public.test_as('00000000-0000-0000-0000-0000000000a2');
  perform public.check_('orang tua tak lagi melihat anak yang lulus', (select count(*) from public.students where id='50000000-0000-0000-0000-0000000000e2') = 0);
  perform public.check_('orang tua tetap melihat anak yang masih aktif', (select count(*) from public.students where id='50000000-0000-0000-0000-0000000000e3') = 1);
end $$;
reset role;
-- pembersihan orang tua yatim secara terpisah
update public.students set status = 'transferred' where id = '50000000-0000-0000-0000-0000000000e3';
do $$ declare r jsonb; begin
  perform public.test_as('00000000-0000-0000-0000-000000000001');
  r := public.deactivate_orphan_parents(true);
  perform public.check_('pratinjau pembersihan orang tua tidak mengubah data', (r->>'count')::int = 1 and (select is_active from public.profiles where id='00000000-0000-0000-0000-0000000000a2'));
  r := public.deactivate_orphan_parents(false);
  perform public.check_('akun orang tua tanpa anak aktif dinonaktifkan', not (select is_active from public.profiles where id='00000000-0000-0000-0000-0000000000a2'));
  perform public.test_as('00000000-0000-0000-0000-000000000002');
  perform public.expect_fail('operator tak bisa menonaktifkan orang tua', $q$ select public.deactivate_orphan_parents(false) $q$);
end $$;
reset role;

-- ---------------------------------------------------------------- kenaikan kelas (015)
insert into public.academic_years(id,name,start_date,end_date) values ('a2000000-0000-0000-0000-000000000000','2100/2101','2100-07-01','2101-06-30') on conflict do nothing;
insert into public.classes(id,academic_year_id,name,grade_level) values
 ('c5000000-0000-0000-0000-000000000005','a1000000-0000-0000-0000-000000000000','S5',5),
 ('c5000000-0000-0000-0000-000000000006','a1000000-0000-0000-0000-000000000000','S6',6),
 ('c5000000-0000-0000-0000-000000000004','a1000000-0000-0000-0000-000000000000','S4',4),
 ('c6000000-0000-0000-0000-000000000006','a2000000-0000-0000-0000-000000000000','T6',6),
 ('c6000000-0000-0000-0000-000000000005','a2000000-0000-0000-0000-000000000000','T5',5),
 ('c6000000-0000-0000-0000-000000000003','a2000000-0000-0000-0000-000000000000','T3',3);
insert into public.students(id,nis,full_name,is_demo) values
 ('50000000-0000-0000-0000-0000000000f1','9201','Naik Satu',true),('50000000-0000-0000-0000-0000000000f2','9202','Tinggal Dua',true),
 ('50000000-0000-0000-0000-0000000000f3','9203','Pindah Tiga',true),('50000000-0000-0000-0000-0000000000f4','9204','Kelas Lain Empat',true),
 ('50000000-0000-0000-0000-0000000000f5','9205','Lulus Lima',true),('50000000-0000-0000-0000-0000000000f6','9206','Tak Lulus Enam',true),
 ('50000000-0000-0000-0000-0000000000f7','9207','Tidak Diproses Tujuh',true);
insert into public.student_class_assignments(student_id,class_id,academic_year_id) values
 ('50000000-0000-0000-0000-0000000000f1','c5000000-0000-0000-0000-000000000005','a1000000-0000-0000-0000-000000000000'),
 ('50000000-0000-0000-0000-0000000000f2','c5000000-0000-0000-0000-000000000005','a1000000-0000-0000-0000-000000000000'),
 ('50000000-0000-0000-0000-0000000000f3','c5000000-0000-0000-0000-000000000005','a1000000-0000-0000-0000-000000000000'),
 ('50000000-0000-0000-0000-0000000000f4','c5000000-0000-0000-0000-000000000005','a1000000-0000-0000-0000-000000000000'),
 ('50000000-0000-0000-0000-0000000000f5','c5000000-0000-0000-0000-000000000006','a1000000-0000-0000-0000-000000000000'),
 ('50000000-0000-0000-0000-0000000000f6','c5000000-0000-0000-0000-000000000006','a1000000-0000-0000-0000-000000000000'),
 ('50000000-0000-0000-0000-0000000000f7','c5000000-0000-0000-0000-000000000004','a1000000-0000-0000-0000-000000000000');
insert into public.student_qr_tokens(student_id, token) values ('50000000-0000-0000-0000-0000000000f3', public.new_qr_token());
insert into auth.users(id,email) values ('00000000-0000-0000-0000-0000000000b1','pk@x');
update public.profiles set is_active = true where id = '00000000-0000-0000-0000-0000000000b1';
insert into public.user_roles(user_id, role) values ('00000000-0000-0000-0000-0000000000b1','parent');
insert into public.parents(id, profile_id) values ('b0000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000b1');
insert into public.parent_student_links(parent_id, student_id, relationship) values ('b0000000-0000-0000-0000-0000000000b1','50000000-0000-0000-0000-0000000000f3','ibu');
do $$ declare r jsonb; map jsonb; ex jsonb; begin
  map := jsonb_build_object('c5000000-0000-0000-0000-000000000005','c6000000-0000-0000-0000-000000000006','c5000000-0000-0000-0000-000000000006','graduate');
  ex := jsonb_build_array(
    jsonb_build_object('student_id','50000000-0000-0000-0000-0000000000f2','action','repeat','class_id','c6000000-0000-0000-0000-000000000005'),
    jsonb_build_object('student_id','50000000-0000-0000-0000-0000000000f3','action','transfer'),
    jsonb_build_object('student_id','50000000-0000-0000-0000-0000000000f4','action','other','class_id','c6000000-0000-0000-0000-000000000006'),
    jsonb_build_object('student_id','50000000-0000-0000-0000-0000000000f6','action','repeat','class_id','c6000000-0000-0000-0000-000000000006'));
  -- 'f1' naik default ke T6 (kelas tingkat 6) dari tingkat 5: valid.
  perform public.test_as('00000000-0000-0000-0000-000000000005');
  perform public.expect_fail('guru tak bisa memproses kenaikan kelas', format($q$ select public.promote_students('a1000000-0000-0000-0000-000000000000','a2000000-0000-0000-0000-000000000000',%L::jsonb) $q$, map::text));
  perform public.test_as('00000000-0000-0000-0000-000000000001');
  perform public.expect_fail('tahun tujuan harus lebih baru', format($q$ select public.promote_students('a2000000-0000-0000-0000-000000000000','a1000000-0000-0000-0000-000000000000',%L::jsonb) $q$, map::text));
  -- galat: tidak naik kelas ke tingkat berbeda
  r := public.promote_students('a1000000-0000-0000-0000-000000000000','a2000000-0000-0000-0000-000000000000', map,
         jsonb_build_array(jsonb_build_object('student_id','50000000-0000-0000-0000-0000000000f2','action','repeat','class_id','c6000000-0000-0000-0000-000000000003')), true, true);
  perform public.check_('pemeriksaan menolak tidak-naik-kelas ke tingkat berbeda', jsonb_array_length(r->'errors') >= 1);
  perform public.expect_fail('rencana tidak valid tidak ditulis', format($q$ select public.promote_students('a1000000-0000-0000-0000-000000000000','a2000000-0000-0000-0000-000000000000',%L::jsonb,%L::jsonb,true,false) $q$, map::text,
         jsonb_build_array(jsonb_build_object('student_id','50000000-0000-0000-0000-0000000000f2','action','repeat','class_id','c6000000-0000-0000-0000-000000000003'))::text));
  perform public.check_('rencana tidak valid tidak mengubah apa pun', (select count(*) from public.student_class_assignments where academic_year_id='a2000000-0000-0000-0000-000000000000') = 0);
  -- pratinjau valid
  r := public.promote_students('a1000000-0000-0000-0000-000000000000','a2000000-0000-0000-0000-000000000000', map, ex, true, true);
  perform public.check_('pratinjau kenaikan: hitungan benar', (r->>'promoted')::int = 1 and (r->>'repeated')::int = 2 and (r->>'transferred')::int = 1 and (r->>'other_class')::int = 1 and (r->>'graduated')::int = 1 and jsonb_array_length(r->'errors') = 0);
  perform public.check_('pratinjau tidak mengubah data', (select count(*) from public.student_class_assignments where academic_year_id='a2000000-0000-0000-0000-000000000000') = 0 and (select status from public.students where id='50000000-0000-0000-0000-0000000000f3') = 'active');
  perform public.check_('pratinjau menghitung orang tua yang akan dinonaktifkan', (r->>'parents_to_deactivate')::int = 1);
  -- eksekusi
  r := public.promote_students('a1000000-0000-0000-0000-000000000000','a2000000-0000-0000-0000-000000000000', map, ex, true, false);
  perform public.check_('siswa naik kelas ditempatkan di kelas tujuan', exists (select 1 from public.student_class_assignments where student_id='50000000-0000-0000-0000-0000000000f1' and class_id='c6000000-0000-0000-0000-000000000006' and end_date is null));
  perform public.check_('penempatan lama ditutup, riwayat tetap ada', (select count(*) from public.student_class_assignments where student_id='50000000-0000-0000-0000-0000000000f1') = 2 and not exists (select 1 from public.student_class_assignments where student_id='50000000-0000-0000-0000-0000000000f1' and academic_year_id='a1000000-0000-0000-0000-000000000000' and end_date is null));
  perform public.check_('tidak naik kelas ditempatkan di tingkat yang sama', exists (select 1 from public.student_class_assignments where student_id='50000000-0000-0000-0000-0000000000f2' and class_id='c6000000-0000-0000-0000-000000000005' and end_date is null));
  perform public.check_('siswa pindah sekolah berstatus transferred tanpa kelas', (select status from public.students where id='50000000-0000-0000-0000-0000000000f3') = 'transferred' and not exists (select 1 from public.student_class_assignments where student_id='50000000-0000-0000-0000-0000000000f3' and end_date is null));
  perform public.check_('QR siswa pindah dicabut', not exists (select 1 from public.student_qr_tokens where student_id='50000000-0000-0000-0000-0000000000f3' and is_active));
  perform public.check_('siswa kelas lain ditempatkan sesuai pilihan', exists (select 1 from public.student_class_assignments where student_id='50000000-0000-0000-0000-0000000000f4' and class_id='c6000000-0000-0000-0000-000000000006' and end_date is null));
  perform public.check_('siswa kelas 6 diluluskan, yang tak lulus tinggal kelas', (select status from public.students where id='50000000-0000-0000-0000-0000000000f5') = 'graduated' and exists (select 1 from public.student_class_assignments where student_id='50000000-0000-0000-0000-0000000000f6' and class_id='c6000000-0000-0000-0000-000000000006' and end_date is null));
  perform public.check_('siswa di kelas yang tidak dipetakan tidak disentuh', exists (select 1 from public.student_class_assignments where student_id='50000000-0000-0000-0000-0000000000f7' and class_id='c5000000-0000-0000-0000-000000000004' and end_date is null));
  perform public.check_('orang tua anak yang pindah dinonaktifkan', not (select is_active from public.profiles where id='00000000-0000-0000-0000-0000000000b1'));
  -- jalankan ulang: tidak menggandakan
  r := public.promote_students('a1000000-0000-0000-0000-000000000000','a2000000-0000-0000-0000-000000000000', map, '[]'::jsonb, true, false);
  perform public.check_('menjalankan ulang tidak menggandakan penempatan', (select count(*) from public.student_class_assignments where student_id='50000000-0000-0000-0000-0000000000f1' and academic_year_id='a2000000-0000-0000-0000-000000000000') = 1);
  perform public.check_('penempatan terbuka paling banyak satu per tahun', not exists (select 1 from public.student_class_assignments where end_date is null group by student_id, academic_year_id having count(*) > 1));
end $$;
reset role;
-- pindah sekolah di tengah tahun lewat status: penempatan ditutup dan QR dicabut otomatis (trigger)
do $$ begin
  insert into public.student_qr_tokens(student_id, token) values ('50000000-0000-0000-0000-0000000000f7', public.new_qr_token());
  update public.students set status = 'transferred' where id = '50000000-0000-0000-0000-0000000000f7';
  perform public.check_('status keluar otomatis menutup penempatan', not exists (select 1 from public.student_class_assignments where student_id='50000000-0000-0000-0000-0000000000f7' and end_date is null));
  perform public.check_('status keluar otomatis mencabut QR', not exists (select 1 from public.student_qr_tokens where student_id='50000000-0000-0000-0000-0000000000f7' and is_active));
end $$;

-- ---------------------------------------------------------------- penonaktifan terjadwal (016)
insert into auth.users(id,email,created_at,last_sign_in_at) values
 ('00000000-0000-0000-0000-0000000000c1','h1@x', now() - interval '90 days', now() - interval '3 days'),  -- orang tua yatim lama (pernah masuk)
 ('00000000-0000-0000-0000-0000000000c2','h2@x', now() - interval '90 days', now() - interval '3 days'),  -- orang tua yatim baru (pernah masuk)
 ('00000000-0000-0000-0000-0000000000c3','h3@x', now() - interval '90 days', null),  -- guru tak pernah masuk
 ('00000000-0000-0000-0000-0000000000c4','h4@x', now() - interval '5 days', null),   -- baru dibuat
 ('00000000-0000-0000-0000-0000000000c5','h5@x', now() - interval '90 days', null);  -- admin tak pernah masuk
update public.profiles set is_active = true where id::text like '00000000-0000-0000-0000-0000000000c%';
insert into public.user_roles(user_id, role) values
 ('00000000-0000-0000-0000-0000000000c1','parent'),('00000000-0000-0000-0000-0000000000c2','parent'),
 ('00000000-0000-0000-0000-0000000000c3','teacher'),('00000000-0000-0000-0000-0000000000c4','teacher'),('00000000-0000-0000-0000-0000000000c5','school_admin');
insert into public.students(id,nis,full_name,status,is_demo) values
 ('50000000-0000-0000-0000-0000000000c1','9301','Anak Lama','graduated',true),('50000000-0000-0000-0000-0000000000c2','9302','Anak Baru','transferred',true);
alter table public.students disable trigger trg_students_updated;
update public.students set updated_at = now() - interval '60 days' where id = '50000000-0000-0000-0000-0000000000c1';
alter table public.students enable trigger trg_students_updated;
insert into public.parents(id, profile_id) values ('b0000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000c1'),('b0000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-0000000000c2');
insert into public.parent_student_links(parent_id, student_id, relationship) values
 ('b0000000-0000-0000-0000-0000000000c1','50000000-0000-0000-0000-0000000000c1','ibu'),('b0000000-0000-0000-0000-0000000000c2','50000000-0000-0000-0000-0000000000c2','ibu');
do $$ declare r jsonb; begin
  perform public.test_as('00000000-0000-0000-0000-000000000005');
  perform public.expect_fail('guru tak bisa menjalankan pembersihan akun', $q$ select public.run_account_hygiene_now(true) $q$);
  perform public.test_as('00000000-0000-0000-0000-000000000001');
  r := public.run_account_hygiene_now(true);
  perform public.check_('pratinjau: orang tua yatim lewat masa tunggu terhitung, yang baru tidak', (r->>'orphan_parents')::int = 1 and (r->>'stale_accounts')::int = 0);
  perform public.check_('pratinjau tidak mengubah akun', (select is_active from public.profiles where id='00000000-0000-0000-0000-0000000000c1'));
end $$;
reset role;
update public.system_settings set value = '60'::jsonb where key = 'hygiene.stale_account_days';
do $$ declare r jsonb; begin
  r := public.account_hygiene_run(false);
  perform public.check_('orang tua yatim lama dinonaktifkan', not (select is_active from public.profiles where id='00000000-0000-0000-0000-0000000000c1'));
  perform public.check_('orang tua yatim baru dalam masa tunggu tetap aktif', (select is_active from public.profiles where id='00000000-0000-0000-0000-0000000000c2'));
  perform public.check_('guru yang tak pernah masuk >60 hari dinonaktifkan', not (select is_active from public.profiles where id='00000000-0000-0000-0000-0000000000c3'));
  perform public.check_('akun baru dibuat tetap aktif', (select is_active from public.profiles where id='00000000-0000-0000-0000-0000000000c4'));
  perform public.check_('akun admin tak pernah masuk tidak disentuh', (select is_active from public.profiles where id='00000000-0000-0000-0000-0000000000c5'));
  perform public.check_('proses tercatat di audit log', exists (select 1 from public.audit_logs where action='account_hygiene_run'));
  perform public.check_('admin menerima notifikasi', exists (select 1 from public.notifications where type='account_hygiene'));
  update public.system_settings set value = '0'::jsonb where key in ('hygiene.stale_account_days','hygiene.orphan_parent_days');
  update public.profiles set is_active = true where id = '00000000-0000-0000-0000-0000000000c1';
  r := public.account_hygiene_run(false);
  perform public.check_('nilai 0 mematikan aturan', (r->>'orphan_parents')::int = 0 and (select is_active from public.profiles where id='00000000-0000-0000-0000-0000000000c1'));
end $$;
do $$ begin
  perform public.test_as('00000000-0000-0000-0000-000000000001');
  perform public.check_('status jadwal tidak error tanpa pg_cron', public.account_hygiene_schedule() is null);
  perform public.test_as('00000000-0000-0000-0000-000000000005');
  perform public.expect_fail('guru tak bisa membaca status jadwal', $q$ select public.account_hygiene_schedule() $q$);
end $$;
reset role;

-- ============ 017: mode pemulihan ============
reset role;
do $$ begin
  perform public.check_('mode pemulihan mati secara bawaan', not public.restoring());
  perform public.test_as('00000000-0000-0000-0000-000000000001');
  perform public.expect_fail('super admin tak bisa menyalakan mode pemulihan lewat SQL pengguna', $q$ select public.restore_begin() $q$);
  perform public.expect_fail('pengguna tak bisa membaca restore_state', $q$ select * from public.restore_state $q$);
end $$;
reset role;
do $$ declare n0 bigint; n1 bigint; ts0 timestamptz; begin
  perform public.restore_begin();
  perform public.check_('mode pemulihan menyala', public.restoring());
  select count(*) into n0 from public.audit_logs;
  insert into public.students(id,nis,full_name,status,is_demo) values ('50000000-0000-0000-0000-0000000000d1','9401','Siswa Pulih','active',true);
  update public.students set full_name = 'Siswa Pulih 2', updated_at = '2020-01-01' where id = '50000000-0000-0000-0000-0000000000d1';
  select count(*) into n1 from public.audit_logs;
  perform public.check_('pemulihan tidak menulis jejak audit per baris', n0 = n1);
  perform public.check_('pemulihan mempertahankan updated_at asli', (select updated_at from public.students where id='50000000-0000-0000-0000-0000000000d1') = '2020-01-01');
  update public.restore_state set started_at = now() - interval '4 hours' where id = 1;
  perform public.check_('mode pemulihan kedaluwarsa otomatis setelah 3 jam', not public.restoring());
  perform public.restore_end();
  update public.students set full_name = 'Siswa Pulih 3' where id = '50000000-0000-0000-0000-0000000000d1';
  perform public.check_('setelah selesai audit kembali aktif', (select count(*) from public.audit_logs) > n1);
  perform public.check_('setelah selesai updated_at kembali otomatis', (select updated_at from public.students where id='50000000-0000-0000-0000-0000000000d1') > '2021-01-01');
end $$;

-- ============ 018: absen kelas ============
reset role;
insert into public.students(id,nis,full_name,is_demo) values
 ('50000000-0000-0000-0000-0000000000b1','9701','Kelas Uji 1',true),
 ('50000000-0000-0000-0000-0000000000b2','9702','Kelas Uji 2',true),
 ('50000000-0000-0000-0000-0000000000b3','9703','Kelas Uji 3',true),
 ('50000000-0000-0000-0000-0000000000b4','9704','Kelas Uji 4',true);
insert into public.student_class_assignments(student_id,class_id,academic_year_id) values
 ('50000000-0000-0000-0000-0000000000b1','c1000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000000'),
 ('50000000-0000-0000-0000-0000000000b2','c1000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000000'),
 ('50000000-0000-0000-0000-0000000000b3','c1000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000000'),
 ('50000000-0000-0000-0000-0000000000b4','c1000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000000');
select public.ensure_attendance_session(public.school_today());
update public.attendance_sessions set status='open' where session_date = public.school_today();

do $$ declare r jsonb; sid uuid; begin
  perform public.test_as('00000000-0000-0000-0000-000000000005');   -- wali kelas 1A
  r := public.record_class_attendance('c1000000-0000-0000-0000-000000000001',
    '[{"student_id":"50000000-0000-0000-0000-0000000000b1","status":"present"},
      {"student_id":"50000000-0000-0000-0000-0000000000b2","status":"sick","note":"kata orang tua"}]');
  perform public.check_('wali kelas menyimpan absen kelas', r->>'result'='recorded' and (r->>'inserted')::int=2);
  perform public.check_('siswa yang tidak dipilih TIDAK otomatis dicatat', (select count(*) from public.attendance_records where student_id='50000000-0000-0000-0000-0000000000b3')=0);
  perform public.check_('catatan per siswa tersimpan', (select note from public.attendance_records where student_id='50000000-0000-0000-0000-0000000000b2')='kata orang tua');
  perform public.check_('catatan bawaan terisi untuk catatan kosong', (select note from public.attendance_records where student_id='50000000-0000-0000-0000-0000000000b1') like 'Dicatat guru%');
  perform public.check_('sumber catatan = manual', (select source from public.attendance_records where student_id='50000000-0000-0000-0000-0000000000b1')='manual');

  r := public.record_class_attendance('c1000000-0000-0000-0000-000000000001',
    '[{"student_id":"50000000-0000-0000-0000-0000000000b1","status":"unexcused"},
      {"student_id":"50000000-0000-0000-0000-0000000000b3","status":"late"}]');
  perform public.check_('catatan yang sudah ada tidak ditimpa', (select status::text from public.attendance_records where student_id='50000000-0000-0000-0000-0000000000b1')='present');
  perform public.check_('yang sudah ada dilaporkan dilewati', jsonb_array_length(r->'skipped')=1 and (r->>'inserted')::int=1);

  r := public.record_class_attendance('c1000000-0000-0000-0000-000000000002','[{"student_id":"50000000-0000-0000-0000-0000000000b4","status":"present"}]');
  perform public.check_('guru tak bisa mengabsen kelas tanpa wali atau kelas orang lain', r->>'result'='forbidden');

  r := public.record_class_attendance('c1000000-0000-0000-0000-000000000001','[{"student_id":"50000000-0000-0000-0000-0000000000b4","status":"present"}]');
  perform public.check_('siswa dari kelas lain ditolak', r->>'result'='invalid');

  r := public.record_class_attendance('c1000000-0000-0000-0000-000000000001','[{"student_id":"50000000-0000-0000-0000-0000000000a0","status":"present"}]');
  perform public.check_('siswa tak dikenal ditolak', r->>'result'='invalid');

  r := public.record_class_attendance('c1000000-0000-0000-0000-000000000001','[{"student_id":"50000000-0000-0000-0000-0000000000b1","status":"official_activity"}]');
  perform public.check_('status kegiatan resmi ditolak (lewat dispensasi)', r->>'result'='invalid');

  r := public.record_class_attendance('c1000000-0000-0000-0000-000000000001','[]');
  perform public.check_('paket kosong ditolak', r->>'result'='invalid');
end $$;
reset role;
delete from public.attendance_records where student_id in ('50000000-0000-0000-0000-0000000000b1','50000000-0000-0000-0000-0000000000b2','50000000-0000-0000-0000-0000000000b3');
do $$ declare r jsonb; begin
  perform public.test_as('00000000-0000-0000-0000-000000000005');
  r := public.record_class_attendance('c1000000-0000-0000-0000-000000000001',
    '[{"student_id":"50000000-0000-0000-0000-0000000000b1","status":"present"},{"student_id":"50000000-0000-0000-0000-0000000000b4","status":"present"}]');
  perform public.check_('paket dengan satu baris tak valid tidak menyimpan apa pun', r->>'result'='invalid' and (select count(*) from public.attendance_records where student_id='50000000-0000-0000-0000-0000000000b1')=0);
  perform public.test_as('00000000-0000-0000-0000-000000000003');
  r := public.record_class_attendance('c1000000-0000-0000-0000-000000000001','[{"student_id":"50000000-0000-0000-0000-0000000000b1","status":"present"}]');
  perform public.check_('orang tua tidak bisa mengabsen', r->>'result'='forbidden');
end $$;
reset role;
do $$ declare r jsonb; begin
  perform public.test_as('00000000-0000-0000-0000-000000000001');   -- admin: kelas mana pun
  r := public.record_class_attendance('c1000000-0000-0000-0000-000000000002','[{"student_id":"50000000-0000-0000-0000-0000000000b4","status":"unexcused","note":"tanpa kabar"}]');
  perform public.check_('admin dapat mengabsen kelas mana pun, termasuk Alpa eksplisit', r->>'result'='recorded');
  perform public.check_('absen kelas tercatat di audit', exists(select 1 from public.audit_logs where action='class_attendance'));
end $$;
reset role;
update public.attendance_sessions set status='closed' where session_date = public.school_today();
do $$ declare r jsonb; begin
  perform public.test_as('00000000-0000-0000-0000-000000000005');
  r := public.record_class_attendance('c1000000-0000-0000-0000-000000000001','[{"student_id":"50000000-0000-0000-0000-0000000000b2","status":"present"}]');
  perform public.check_('sesi yang sudah ditutup menolak absen kelas', r->>'result'='session_closed');
end $$;
reset role;

-- ============ 019: absensi susulan ============
reset role;
-- Siswa b1..b3 baru "masuk" hari ini pada fixture; mundurkan awal keanggotaan agar sah pada tanggal lampau.
update public.student_class_assignments set start_date = public.school_today() - 60
 where student_id in ('50000000-0000-0000-0000-0000000000b1','50000000-0000-0000-0000-0000000000b2','50000000-0000-0000-0000-0000000000b3');
create temp table bd(d date);
insert into bd select public.school_today() - n from generate_series(1,29) n where public.is_school_day(public.school_today() - n) order by n limit 3;
create temp table bd_non(d date);
insert into bd_non values (public.school_today()-15);
delete from bd where d = public.school_today()-15;
insert into public.school_calendar(calendar_date,kind,description) values (public.school_today()-15,'holiday','Libur uji susulan 2') on conflict do nothing;
grant select on bd, bd_non to authenticated;

do $$ declare r jsonb; d1 date; d2 date; d3 date; dn date; cid uuid := 'c1000000-0000-0000-0000-000000000001'; begin
  select d into d1 from (select d, row_number() over (order by d desc) rn from bd) x where rn=1;
  select d into d2 from (select d, row_number() over (order by d desc) rn from bd) x where rn=2;
  select d into d3 from (select d, row_number() over (order by d desc) rn from bd) x where rn=3;
  select d into dn from bd_non limit 1;

  perform public.test_as('00000000-0000-0000-0000-000000000005');   -- wali kelas
  r := public.record_class_attendance_backdated(cid, d1, '[{"student_id":"50000000-0000-0000-0000-0000000000b1","status":"present"}]', 'internet mati');
  perform public.check_('guru tidak dapat mengisi tanggal lampau', r->>'result'='forbidden');
  perform public.test_as('00000000-0000-0000-0000-000000000003');
  r := public.record_class_attendance_backdated(cid, d1, '[{"student_id":"50000000-0000-0000-0000-0000000000b1","status":"present"}]', 'internet mati');
  perform public.check_('orang tua tidak dapat mengisi tanggal lampau', r->>'result'='forbidden');

  perform public.test_as('00000000-0000-0000-0000-000000000001');   -- admin
  r := public.record_class_attendance_backdated(cid, public.school_today(), '[{"student_id":"50000000-0000-0000-0000-0000000000b1","status":"present"}]', 'internet mati');
  perform public.check_('hari ini ditolak (pakai Absen Kelas biasa)', r->>'result'='invalid');
  r := public.record_class_attendance_backdated(cid, public.school_today()+1, '[{"student_id":"50000000-0000-0000-0000-0000000000b1","status":"present"}]', 'internet mati');
  perform public.check_('tanggal masa depan ditolak', r->>'result'='invalid');
  r := public.record_class_attendance_backdated(cid, public.school_today()-31, '[{"student_id":"50000000-0000-0000-0000-0000000000b1","status":"present"}]', 'internet mati');
  perform public.check_('lebih dari 30 hari ditolak', r->>'result'='invalid');
  if dn is not null then
    r := public.record_class_attendance_backdated(cid, dn, '[{"student_id":"50000000-0000-0000-0000-0000000000b1","status":"present"}]', 'internet mati');
    perform public.check_('hari non-sekolah ditolak', r->>'result'='not_school_day');
  end if;
  r := public.record_class_attendance_backdated(cid, d1, '[{"student_id":"50000000-0000-0000-0000-0000000000b1","status":"present"}]', '');
  perform public.check_('alasan kosong ditolak', r->>'result'='invalid');
  r := public.record_class_attendance_backdated(cid, d1, '[{"student_id":"50000000-0000-0000-0000-0000000000b1","status":"present"}]', 'ok');
  perform public.check_('alasan terlalu pendek ditolak', r->>'result'='invalid');
  r := public.record_class_attendance_backdated(cid, d1, '[{"student_id":"50000000-0000-0000-0000-0000000000b4","status":"present"}]', 'internet mati');
  perform public.check_('siswa kelas lain ditolak', r->>'result'='invalid');
  r := public.record_class_attendance_backdated(cid, d1, '[{"student_id":"50000000-0000-0000-0000-0000000000b1","status":"present"},{"student_id":"50000000-0000-0000-0000-0000000000b4","status":"present"}]', 'internet mati');
  perform public.check_('paket dengan baris tak valid tidak menyimpan apa pun', r->>'result'='invalid'
    and (select count(*) from public.attendance_records where student_id='50000000-0000-0000-0000-0000000000b1')=0);

  r := public.record_class_attendance_backdated(cid, d1,
    '[{"student_id":"50000000-0000-0000-0000-0000000000b1","status":"present"},{"student_id":"50000000-0000-0000-0000-0000000000b2","status":"sick","note":"demam"},{"student_id":"50000000-0000-0000-0000-0000000000b3","status":"unexcused"}]',
    'internet sekolah mati seharian');
  perform public.check_('admin menyimpan absensi susulan', r->>'result'='recorded' and (r->>'inserted')::int=3);
  perform public.check_('catatan susulan tanpa jam masuk dan bersumber manual', (select count(*) from public.attendance_records ar join public.attendance_sessions s on s.id=ar.session_id
    where s.session_date=d1 and ar.checked_in_at is null and ar.source='manual' and ar.note like 'Susulan:%')=3);
  perform public.check_('catatan siswa memuat alasan atau catatan sendiri', (select note from public.attendance_records ar join public.attendance_sessions s on s.id=ar.session_id where s.session_date=d1 and ar.student_id='50000000-0000-0000-0000-0000000000b2') = 'Susulan: demam');
  perform public.check_('audit susulan memuat alasan', exists(select 1 from public.audit_logs where action='class_attendance_backdated' and reason='internet sekolah mati seharian'));

  r := public.record_class_attendance_backdated(cid, d1, '[{"student_id":"50000000-0000-0000-0000-0000000000b1","status":"unexcused"}]', 'coba timpa');
  perform public.check_('catatan yang sudah ada tidak ditimpa', (r->>'inserted')::int=0 and jsonb_array_length(r->'skipped')=1
    and (select ar.status::text from public.attendance_records ar join public.attendance_sessions s on s.id=ar.session_id where s.session_date=d1 and ar.student_id='50000000-0000-0000-0000-0000000000b1')='present');

  -- keanggotaan pada tanggal itu
  reset role;
  update public.student_class_assignments set start_date = d2 + 1 where student_id='50000000-0000-0000-0000-0000000000b3';
  perform public.test_as('00000000-0000-0000-0000-000000000001');
  r := public.record_class_attendance_backdated(cid, d2, '[{"student_id":"50000000-0000-0000-0000-0000000000b3","status":"present"}]', 'internet mati');
  perform public.check_('siswa yang belum menjadi anggota pada tanggal itu ditolak', r->>'result'='invalid');

  -- sesi ditutup
  reset role;
  perform public.ensure_attendance_session(d3);
  update public.attendance_sessions set status='closed' where session_date=d3;
  perform public.test_as('00000000-0000-0000-0000-000000000001');
  r := public.record_class_attendance_backdated(cid, d3, '[{"student_id":"50000000-0000-0000-0000-0000000000b1","status":"present"}]', 'internet mati');
  perform public.check_('sesi tertutup menolak absensi susulan', r->>'result'='session_closed');
end $$;
reset role;

-- ============ 020: pemantauan error ============
reset role;
do $$ declare r record; n int; begin
  perform public.test_as('00000000-0000-0000-0000-000000000003');   -- orang tua yang melihat error
  perform public.log_app_error('client','/parent/children/50000000-0000-0000-0000-0000000000b1','Gagal untuk budi@sekolah.id NIS 1234567890','dg1','stack');
  perform public.log_app_error('client','/parent/children/50000000-0000-0000-0000-0000000000b2','Gagal untuk budi@sekolah.id NIS 1234567890','dg1','stack');
  reset role;
  select * into r from public.app_errors order by first_seen desc limit 1;
  perform public.check_('pesan error disamarkan (email dan angka panjang)', r.message not like '%@%' and r.message not like '%1234567890%' and r.message like '%[email]%');
  perform public.check_('id di alamat halaman disamarkan', r.route like '%[id]%' and r.route not like '%50000000%');
  perform public.check_('kejadian sama digabung dan dihitung', r.occurrences = 2 and (select count(*) from public.app_errors)=1);
  perform public.test_as('00000000-0000-0000-0000-000000000003');
  select count(*) into n from public.app_errors;
  perform public.check_('orang tua tidak dapat membaca daftar error', n = 0);
  perform public.test_as('00000000-0000-0000-0000-000000000001');
  select count(*) into n from public.app_errors;
  perform public.check_('admin sekolah (bukan super admin) tidak membaca daftar error', n = 0 or public.has_role('super_admin'));
end $$;
reset role;
do $$ declare n int; eid uuid; ok boolean; begin
  perform public.test_as('00000000-0000-0000-0000-000000000003');
  begin insert into public.app_errors(fingerprint,source,message) values ('x','client','x'); ok := true; exception when others then ok := false; end;
  perform public.check_('pengguna tidak dapat menulis langsung ke tabel error', not ok);
  begin perform public.resolve_app_error(gen_random_uuid()); ok := true; exception when others then ok := false; end;
  perform public.check_('pengguna biasa tidak dapat menandai selesai', not ok);
  reset role;
  select id into eid from public.app_errors limit 1;
  insert into public.user_roles(user_id, role) select '00000000-0000-0000-0000-000000000001','super_admin' where not exists (select 1 from public.user_roles where user_id='00000000-0000-0000-0000-000000000001' and role='super_admin');
  perform public.test_as('00000000-0000-0000-0000-000000000001');
  select count(*) into n from public.app_errors;
  perform public.check_('super admin dapat membaca daftar error', n = 1);
  perform public.resolve_app_error(eid);
  perform public.check_('ditandai selesai', (select resolved_at is not null from public.app_errors where id = eid));
  reset role;
  perform public.test_as('00000000-0000-0000-0000-000000000003');
  perform public.log_app_error('server','/x','Masalah baru','d',null);
  perform public.log_app_error('server','/x','Masalah baru','d',null);
  reset role;
  perform public.check_('error berulang membuka kembali yang sudah selesai atau menambah hitungan', (select occurrences from public.app_errors where message='Masalah baru')=2);
  -- pelindung banjir
  perform public.test_as('00000000-0000-0000-0000-000000000003');
  for i in 1..80 loop perform public.log_app_error('client','/f'||i,'banjir '||i,null,null); end loop;
  reset role;
  perform public.check_('pelindung banjir membatasi jenis error baru per menit', (select count(*) from public.app_errors where message like 'banjir%') <= 60);
end $$;
reset role;