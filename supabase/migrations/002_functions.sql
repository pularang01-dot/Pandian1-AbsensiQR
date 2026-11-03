-- PANDIAN SMART ATTENDANCE - Migrasi 002: fungsi, RPC transaksional, trigger, audit
-- Semua RPC memakai SECURITY DEFINER + pengecekan peran di dalam fungsi.

alter table public.attendance_records
  add constraint ar_permission_fk foreign key (permission_request_id) references public.permission_requests(id),
  add constraint ar_dispensation_fk foreign key (dispensation_id) references public.dispensations(id);

-- ================================================================ Pembantu peran
create or replace function public.has_role(r public.app_role) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = auth.uid() and ur.role = r and p.is_active
  );
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role('super_admin') or public.has_role('school_admin');
$$;

create or replace function public.is_approver() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.has_role('principal');
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_approver() or public.has_role('teacher') or public.has_role('operator');
$$;

create or replace function public.can_record_attendance() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.has_role('teacher') or public.has_role('operator');
$$;

create or replace function public.is_parent_of(p_student uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.parent_student_links l
    join public.parents pa on pa.id = l.parent_id
    join public.profiles pr on pr.id = pa.profile_id
    where pa.profile_id = auth.uid() and l.student_id = p_student and l.is_active and pr.is_active
  );
$$;

-- Guru hanya untuk siswa di kelas yang diampu (wali kelas).
create or replace function public.teaches_student(p_student uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.student_class_assignments a
    join public.classes c on c.id = a.class_id
    where a.student_id = p_student and a.end_date is null and c.homeroom_teacher_id = auth.uid()
  );
$$;

create or replace function public.can_view_student(p_student uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.has_role('principal') or public.has_role('operator')
      or (public.has_role('teacher') and public.teaches_student(p_student))
      or public.is_parent_of(p_student);
$$;

-- ================================================================ Pengaturan
create or replace function public.get_setting(p_key text, p_default jsonb) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((select value from public.system_settings where key = p_key), p_default);
$$;

create or replace function public.school_today() returns date
language sql stable security definer set search_path = public as $$
  select (now() at time zone coalesce(public.get_setting('school.timezone','"Asia/Jakarta"') #>> '{}', 'Asia/Jakarta'))::date;
$$;

create or replace function public.school_now_time() returns time
language sql stable security definer set search_path = public as $$
  select (now() at time zone coalesce(public.get_setting('school.timezone','"Asia/Jakarta"') #>> '{}', 'Asia/Jakarta'))::time;
$$;

create or replace function public.is_school_day(d date) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare days int[];
begin
  if exists (select 1 from public.school_calendar where calendar_date = d and kind = 'holiday') then
    return false;
  end if;
  if exists (select 1 from public.school_calendar where calendar_date = d and kind = 'extra_school_day') then
    return true;
  end if;
  select array(select jsonb_array_elements_text(public.get_setting('attendance.school_days','[1,2,3,4,5]'::jsonb))::int) into days;
  return extract(isodow from d)::int = any(days);
end $$;

-- Membuat sesi absensi harian bila belum ada (waktu mengikuti pengaturan).
create or replace function public.ensure_attendance_session(d date) returns uuid
language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  select id into sid from public.attendance_sessions where session_date = d;
  if sid is not null then return sid; end if;
  insert into public.attendance_sessions (session_date, start_time, late_after, close_time, created_by)
  values (
    d,
    (public.get_setting('attendance.start_time','"07:00"') #>> '{}')::time,
    (public.get_setting('attendance.late_after','"07:15"') #>> '{}')::time,
    (public.get_setting('attendance.close_time','"09:00"') #>> '{}')::time,
    auth.uid()
  )
  on conflict (session_date) do nothing;
  select id into sid from public.attendance_sessions where session_date = d;
  return sid;
end $$;

-- ================================================================ Audit
create or replace function public.write_audit(p_action text, p_table text, p_entity text, p_old jsonb, p_new jsonb, p_reason text default null)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_logs(actor_id, action, entity_table, entity_id, old_data, new_data, reason)
  values (auth.uid(), p_action, p_table, p_entity, p_old, p_new, p_reason);
$$;

create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare ent text;
begin
  if tg_op = 'DELETE' then
    ent := coalesce(to_jsonb(old)->>'id', to_jsonb(old)->>'key', to_jsonb(old)->>'user_id');
    perform public.write_audit('delete', tg_table_name, ent, to_jsonb(old), null);
    return old;
  elsif tg_op = 'UPDATE' then
    ent := coalesce(to_jsonb(new)->>'id', to_jsonb(new)->>'key', to_jsonb(new)->>'user_id');
    perform public.write_audit('update', tg_table_name, ent, to_jsonb(old), to_jsonb(new));
    return new;
  else
    ent := coalesce(to_jsonb(new)->>'id', to_jsonb(new)->>'key', to_jsonb(new)->>'user_id');
    perform public.write_audit('insert', tg_table_name, ent, null, to_jsonb(new));
    return new;
  end if;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','user_roles','students','classes','academic_years','student_class_assignments',
    'parent_student_links','student_qr_tokens','school_calendar','system_settings',
    'permission_requests','dispensations','dispensation_students','early_dismissal_requests',
    'early_dismissal_handover_logs'
  ] loop
    execute format('create trigger trg_audit_%1$s after insert or update or delete on public.%1$s
                    for each row execute function public.audit_row()', t);
  end loop;
end $$;

-- Pencatatan absensi baru terlalu sering; audit hanya untuk perubahan dan penghapusan.
create trigger trg_audit_attendance_records after update or delete on public.attendance_records
  for each row execute function public.audit_row();

-- ================================================================ Pengguna baru
-- Akun baru TIDAK aktif dan tanpa peran sampai administrator mengaktifkannya.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, is_active)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1)), false)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Pembuatan administrator pertama: hanya berhasil bila belum ada super_admin.
create or replace function public.bootstrap_super_admin(p_email text) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if exists (select 1 from public.user_roles where role = 'super_admin') then
    raise exception 'Super admin sudah ada. Gunakan menu Pengaturan > Pengguna.';
  end if;
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then
    raise exception 'Pengguna dengan email tersebut belum dibuat di Supabase Auth.';
  end if;
  insert into public.profiles (id, full_name, is_active)
  values (uid, split_part(p_email,'@',1), true)
  on conflict (id) do update set is_active = true;
  insert into public.user_roles (user_id, role) values (uid, 'super_admin') on conflict do nothing;
  return 'Super admin berhasil dibuat untuk ' || p_email;
end $$;
revoke all on function public.bootstrap_super_admin(text) from public, anon, authenticated;

-- ================================================================ Trigger izin
create or replace function public.permission_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Pengajuan setelah tanggal ketidakhadiran ditandai retroaktif dan wajib ditinjau lebih lanjut.
  new.is_retrospective := new.start_date < public.school_today();
  new.submitted_at := now();
  if not public.is_staff() then
    new.status := 'pending';
    new.entered_manually := false;
    new.requested_by := auth.uid();
  end if;
  return new;
end $$;
create trigger trg_permission_before_insert before insert on public.permission_requests
  for each row execute function public.permission_before_insert();

-- Pengaju hanya boleh mengubah permintaan menjadi 'cancelled'; perubahan lain lewat RPC.
create or replace function public.permission_guard_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if current_setting('app.via_rpc', true) = 'on' then return new; end if;
  if new.status = 'cancelled' and old.status in ('pending','needs_clarification','under_review')
     and old.requested_by = auth.uid()
     and (to_jsonb(new) - 'status' - 'updated_at') = (to_jsonb(old) - 'status' - 'updated_at') then
    return new;
  end if;
  raise exception 'Perubahan langsung tidak diizinkan. Gunakan proses peninjauan.';
end $$;
create trigger trg_permission_guard before update on public.permission_requests
  for each row execute function public.permission_guard_update();

-- ================================================================ Notifikasi
create or replace function public.notify(p_user uuid, p_type text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications(user_id, type, title, body, link) values (p_user, p_type, p_title, p_body, p_link);
$$;

create or replace function public.notify_role(p_role public.app_role, p_type text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications(user_id, type, title, body, link)
  select ur.user_id, p_type, p_title, p_body, p_link
  from public.user_roles ur join public.profiles p on p.id = ur.user_id
  where ur.role = p_role and p.is_active;
$$;

create or replace function public.permission_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.permission_request_events(request_id, action, actor_id, note)
  values (new.id, 'submitted', new.requested_by, case when new.is_retrospective then 'Pengajuan retroaktif' else null end);
  perform public.notify_role('school_admin','permission_new','Pengajuan izin baru','Ada pengajuan izin yang menunggu peninjauan.','/permissions/' || new.id);
  perform public.notify_role('principal','permission_new','Pengajuan izin baru','Ada pengajuan izin yang menunggu peninjauan.','/permissions/' || new.id);
  return new;
end $$;
create trigger trg_permission_after_insert after insert on public.permission_requests
  for each row execute function public.permission_after_insert();

-- ================================================================ Absensi: QR & manual
-- Langkah 1: cari siswa dari QR TANPA mencatat (operator memastikan identitas secara visual).
create or replace function public.lookup_qr_token(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.student_qr_tokens; s public.students; cls text; sid uuid; rec public.attendance_records;
begin
  if not public.can_record_attendance() then
    return jsonb_build_object('result','forbidden');
  end if;
  select * into t from public.student_qr_tokens where token = trim(p_token);
  if not found then return jsonb_build_object('result','invalid'); end if;
  if not t.is_active then return jsonb_build_object('result','revoked'); end if;
  select * into s from public.students where id = t.student_id;
  if s.status <> 'active' then return jsonb_build_object('result','student_inactive'); end if;
  -- Guru hanya untuk siswa di kelas yang diampu.
  if not (public.is_admin() or public.has_role('operator') or public.teaches_student(s.id)) then
    return jsonb_build_object('result','forbidden');
  end if;

  select c.name into cls from public.student_class_assignments a join public.classes c on c.id = a.class_id
   where a.student_id = s.id and a.end_date is null limit 1;

  select id into sid from public.attendance_sessions where session_date = public.school_today();
  if sid is not null then
    select * into rec from public.attendance_records where session_id = sid and student_id = s.id;
  end if;

  return jsonb_build_object(
    'result', case when rec.id is not null then 'duplicate' else 'ok' end,
    'student_id', s.id, 'full_name', s.full_name, 'nis', s.nis, 'class_name', cls,
    'existing_status', rec.status, 'existing_at', rec.checked_in_at
  );
end $$;

-- Langkah 2: catat kehadiran setelah operator mengonfirmasi.
create or replace function public.record_attendance(
  p_student_id uuid,
  p_source public.attendance_source,
  p_qr_token text default null,
  p_status public.attendance_status default null,
  p_note text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  today date := public.school_today();
  sid uuid; sess public.attendance_sessions; s public.students; cls uuid; tok public.student_qr_tokens;
  final_status public.attendance_status; rec public.attendance_records;
begin
  if not public.can_record_attendance() then
    return jsonb_build_object('result','forbidden','message','Anda tidak berwenang mencatat absensi.');
  end if;
  if p_source not in ('qr','manual') then
    return jsonb_build_object('result','invalid_source');
  end if;

  select * into s from public.students where id = p_student_id;
  if not found or s.status <> 'active' then
    return jsonb_build_object('result','student_inactive','message','Siswa tidak ditemukan atau tidak aktif.');
  end if;
  if not (public.is_admin() or public.has_role('operator') or public.teaches_student(s.id)) then
    return jsonb_build_object('result','forbidden','message','Siswa ini bukan di kelas yang Anda ampu.');
  end if;
  if not public.is_school_day(today) then
    return jsonb_build_object('result','not_school_day','message','Hari ini bukan hari sekolah.');
  end if;

  sid := public.ensure_attendance_session(today);
  select * into sess from public.attendance_sessions where id = sid;
  if sess.status = 'closed' then
    return jsonb_build_object('result','session_closed','message','Sesi absensi hari ini sudah ditutup.');
  end if;

  if p_source = 'qr' then
    select * into tok from public.student_qr_tokens where token = trim(coalesce(p_qr_token,''));
    if not found then return jsonb_build_object('result','invalid','message','Kode QR tidak dikenal.'); end if;
    if not tok.is_active then return jsonb_build_object('result','revoked','message','Kode QR sudah dinonaktifkan.'); end if;
    if tok.student_id <> s.id then return jsonb_build_object('result','invalid','message','Kode QR tidak cocok dengan siswa.'); end if;
    final_status := case when public.school_now_time() <= sess.late_after then 'present' else 'late' end;
  else
    if coalesce(length(trim(p_note)),0) < 3 then
      return jsonb_build_object('result','note_required','message','Catatan alasan wajib untuk absensi manual.');
    end if;
    final_status := coalesce(p_status, 'present');
    if final_status = 'official_activity' then
      return jsonb_build_object('result','not_allowed','message','Kegiatan resmi dicatat melalui modul dispensasi.');
    end if;
    if final_status not in ('present','late') and not public.is_admin() then
      return jsonb_build_object('result','not_allowed','message','Status ini hanya dapat dicatat oleh administrator.');
    end if;
  end if;

  select * into rec from public.attendance_records where session_id = sid and student_id = s.id;
  if found then
    return jsonb_build_object('result','duplicate','existing_status',rec.status,'existing_at',rec.checked_in_at,
      'message','Siswa sudah tercatat. Gunakan koreksi bila data perlu diubah.');
  end if;

  select a.class_id into cls from public.student_class_assignments a where a.student_id = s.id and a.end_date is null limit 1;

  begin
    insert into public.attendance_records(session_id, student_id, class_id, status, source, checked_in_at, recorded_by, qr_token_id, note)
    values (sid, s.id, cls, final_status, p_source, now(), auth.uid(), tok.id, nullif(trim(p_note),''));
  exception when unique_violation then
    return jsonb_build_object('result','duplicate','message','Siswa sudah tercatat.');
  end;

  return jsonb_build_object('result','recorded','status',final_status,'full_name',s.full_name,'recorded_at',now());
end $$;

-- Koreksi absensi: tidak menimpa diam-diam; selalu ada jejak.
create or replace function public.correct_attendance(p_record_id uuid, p_new_status public.attendance_status, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare rec public.attendance_records;
begin
  select * into rec from public.attendance_records where id = p_record_id for update;
  if not found then raise exception 'Data absensi tidak ditemukan.'; end if;
  if not (public.is_approver() or (public.has_role('teacher') and public.teaches_student(rec.student_id))) then
    raise exception 'Anda tidak berwenang mengoreksi absensi ini.';
  end if;
  if coalesce(length(trim(p_reason)),0) < 5 then raise exception 'Alasan koreksi wajib diisi (minimal 5 karakter).'; end if;
  if rec.status = p_new_status then raise exception 'Status baru sama dengan status saat ini.'; end if;

  insert into public.attendance_corrections(record_id, previous_status, new_status, reason, corrected_by)
  values (rec.id, rec.status, p_new_status, trim(p_reason), auth.uid());

  update public.attendance_records set status = p_new_status, updated_at = now() where id = rec.id;
  perform public.write_audit('correct_attendance','attendance_records', rec.id::text,
    jsonb_build_object('status',rec.status), jsonb_build_object('status',p_new_status), trim(p_reason));
  perform public.notify_role('school_admin','attendance_correction','Koreksi absensi','Absensi seorang siswa dikoreksi.','/attendance/history');
end $$;

-- Rekonsiliasi eksplisit: siswa tanpa catatan pada hari itu menjadi Alpa. TIDAK otomatis.
create or replace function public.reconcile_attendance(p_date date) returns integer
language plpgsql security definer set search_path = public as $$
declare sid uuid; n integer;
begin
  if not public.is_admin() then raise exception 'Hanya administrator yang dapat melakukan rekonsiliasi.'; end if;
  if p_date >= public.school_today() and public.school_now_time() < (public.get_setting('attendance.close_time','"09:00"') #>> '{}')::time then
    raise exception 'Rekonsiliasi hanya dapat dilakukan setelah jam penutupan absensi.';
  end if;
  if not public.is_school_day(p_date) then raise exception 'Tanggal tersebut bukan hari sekolah.'; end if;
  sid := public.ensure_attendance_session(p_date);

  insert into public.attendance_records(session_id, student_id, class_id, status, source, recorded_by, note)
  select sid, s.id, a.class_id, 'unexcused', 'system', auth.uid(), 'Rekonsiliasi: tidak ada catatan kehadiran'
  from public.students s
  left join public.student_class_assignments a on a.student_id = s.id and a.end_date is null
  where s.status = 'active'
    and not exists (select 1 from public.attendance_records r where r.session_id = sid and r.student_id = s.id)
  on conflict (session_id, student_id) do nothing;
  get diagnostics n = row_count;

  update public.attendance_sessions set status = 'closed' where id = sid;
  perform public.write_audit('reconcile','attendance_sessions', sid::text, null, jsonb_build_object('date',p_date,'marked_unexcused',n));
  return n;
end $$;

-- ================================================================ Token QR
create or replace function public.regenerate_qr_token(p_student_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare new_token text;
begin
  if not public.is_admin() then raise exception 'Hanya administrator yang dapat menerbitkan QR.'; end if;
  if not exists (select 1 from public.students where id = p_student_id) then raise exception 'Siswa tidak ditemukan.'; end if;
  update public.student_qr_tokens set is_active = false, revoked_at = now(), revoked_by = auth.uid()
   where student_id = p_student_id and is_active;
  new_token := encode(gen_random_bytes(24), 'hex');   -- 48 karakter acak, tanpa data pribadi
  insert into public.student_qr_tokens(student_id, token, issued_by) values (p_student_id, new_token, auth.uid());
  return new_token;
end $$;

-- ================================================================ Peninjauan izin
create or replace function public.review_permission(p_request_id uuid, p_action text, p_note text default null)
returns public.request_status
language plpgsql security definer set search_path = public as $$
declare
  r public.permission_requests; d date; sid uuid; att_status public.attendance_status;
  cls uuid; ex public.attendance_records; applied int := 0; skipped int := 0; parent_user uuid; new_status public.request_status;
begin
  if not public.is_approver() then raise exception 'Anda tidak berwenang meninjau izin.'; end if;
  select * into r from public.permission_requests where id = p_request_id for update;
  if not found then raise exception 'Pengajuan tidak ditemukan.'; end if;
  perform set_config('app.via_rpc','on', true);
  parent_user := r.requested_by;

  if p_action = 'start_review' then
    if r.status <> 'pending' then raise exception 'Hanya pengajuan berstatus Menunggu yang dapat ditinjau.'; end if;
    new_status := 'under_review';

  elsif p_action = 'request_clarification' then
    if r.status not in ('pending','under_review') then raise exception 'Status pengajuan tidak memungkinkan permintaan klarifikasi.'; end if;
    if coalesce(length(trim(p_note)),0) < 3 then raise exception 'Catatan klarifikasi wajib diisi.'; end if;
    new_status := 'needs_clarification';

  elsif p_action = 'reject' then
    if r.status not in ('pending','under_review','needs_clarification') then raise exception 'Status pengajuan tidak memungkinkan penolakan.'; end if;
    if coalesce(length(trim(p_note)),0) < 3 then raise exception 'Alasan penolakan wajib diisi.'; end if;
    new_status := 'rejected';

  elsif p_action = 'approve' then
    if r.status not in ('pending','under_review') then raise exception 'Hanya pengajuan Menunggu/Sedang Ditinjau yang dapat disetujui.'; end if;
    if not exists (select 1 from public.students where id = r.student_id and status = 'active') then
      raise exception 'Siswa tidak aktif.';
    end if;
    if not r.entered_manually and not public.is_parent_of_user(r.requested_by, r.student_id) then
      raise exception 'Pengaju tidak terhubung dengan siswa ini.';
    end if;
    if r.end_date < r.start_date then raise exception 'Rentang tanggal tidak valid.'; end if;
    if exists (
      select 1 from public.permission_requests o
      where o.student_id = r.student_id and o.id <> r.id and o.status = 'approved'
        and o.start_date <= r.end_date and o.end_date >= r.start_date
    ) then raise exception 'Bertentangan dengan izin lain yang sudah disetujui pada rentang tanggal yang sama.'; end if;
    if r.is_retrospective and coalesce(length(trim(p_note)),0) < 5 then
      raise exception 'Pengajuan retroaktif memerlukan catatan peninjauan sebelum disetujui.';
    end if;

    att_status := case r.category when 'sick' then 'sick' else 'permission' end;
    select a.class_id into cls from public.student_class_assignments a where a.student_id = r.student_id and a.end_date is null limit 1;

    for d in select generate_series(r.start_date, r.end_date, interval '1 day')::date loop
      if not public.is_school_day(d) then continue; end if;   -- libur tidak dihitung
      sid := public.ensure_attendance_session(d);
      select * into ex from public.attendance_records where session_id = sid and student_id = r.student_id for update;
      if not found then
        insert into public.attendance_records(session_id, student_id, class_id, status, source, recorded_by, permission_request_id, note)
        values (sid, r.student_id, cls, att_status, 'permission', auth.uid(), r.id, 'Izin disetujui');
        applied := applied + 1;
      elsif ex.status in ('unverified','unexcused') then
        insert into public.attendance_corrections(record_id, previous_status, new_status, reason, corrected_by)
        values (ex.id, ex.status, att_status, 'Izin disetujui (pengajuan ' || r.id || ')', auth.uid());
        update public.attendance_records set status = att_status, source = 'permission', permission_request_id = r.id where id = ex.id;
        applied := applied + 1;
      else
        skipped := skipped + 1;   -- kehadiran fisik (hadir/terlambat) tidak ditimpa
      end if;
    end loop;
    new_status := 'approved';

  elsif p_action = 'cancel_approval' then
    if r.status <> 'approved' then raise exception 'Hanya izin yang sudah disetujui yang dapat dibatalkan.'; end if;
    if coalesce(length(trim(p_note)),0) < 5 then raise exception 'Alasan pembatalan wajib diisi.'; end if;
    for ex in select * from public.attendance_records where permission_request_id = r.id loop
      insert into public.attendance_corrections(record_id, previous_status, new_status, reason, corrected_by)
      values (ex.id, ex.status, 'unverified', 'Persetujuan izin dibatalkan: ' || trim(p_note), auth.uid());
      update public.attendance_records set status = 'unverified', source = 'system' where id = ex.id;
    end loop;
    new_status := 'cancelled';
  else
    raise exception 'Aksi tidak dikenal.';
  end if;

  update public.permission_requests
     set status = new_status, reviewed_by = auth.uid(), reviewed_at = now(),
         review_note = coalesce(nullif(trim(p_note),''), review_note)
   where id = r.id;

  insert into public.permission_request_events(request_id, action, actor_id, note)
  values (r.id, p_action, auth.uid(),
          concat_ws(' | ', nullif(trim(p_note),''), case when p_action='approve' then format('%s tanggal diterapkan, %s tidak diubah (kehadiran fisik)', applied, skipped) end));
  perform public.write_audit('permission_'||p_action, 'permission_requests', r.id::text,
    jsonb_build_object('status', r.status), jsonb_build_object('status', new_status), p_note);

  perform public.notify(parent_user, 'permission_'||p_action,
    case p_action when 'approve' then 'Izin disetujui' when 'reject' then 'Izin ditolak'
                  when 'request_clarification' then 'Diperlukan klarifikasi' else 'Status izin diperbarui' end,
    coalesce(nullif(trim(p_note),''), 'Silakan buka pengajuan untuk melihat rinciannya.'), '/parent/permissions');
  return new_status;
end $$;

create or replace function public.is_parent_of_user(p_user uuid, p_student uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.parent_student_links l join public.parents pa on pa.id = l.parent_id
    where pa.profile_id = p_user and l.student_id = p_student and l.is_active
  );
$$;

-- ================================================================ Dispensasi
create or replace function public.review_dispensation(p_id uuid, p_action text, p_note text default null)
returns public.dispensation_status
language plpgsql security definer set search_path = public as $$
declare dsp public.dispensations; new_status public.dispensation_status;
begin
  select * into dsp from public.dispensations where id = p_id for update;
  if not found then raise exception 'Dispensasi tidak ditemukan.'; end if;

  if p_action in ('approve','reject') then
    if not public.is_approver() then raise exception 'Anda tidak berwenang menyetujui dispensasi.'; end if;
    if dsp.status <> 'pending' then raise exception 'Hanya dispensasi berstatus Menunggu yang dapat diputuskan.'; end if;
    if p_action = 'reject' and coalesce(length(trim(p_note)),0) < 3 then raise exception 'Alasan penolakan wajib diisi.'; end if;
    if p_action = 'approve' and not exists (select 1 from public.dispensation_students where dispensation_id = p_id) then
      raise exception 'Dispensasi belum memiliki siswa peserta.';
    end if;
    new_status := case p_action when 'approve' then 'approved' else 'rejected' end;
  elsif p_action = 'cancel' then
    if not (public.is_approver() or dsp.requested_by = auth.uid()) then raise exception 'Tidak berwenang membatalkan.'; end if;
    if dsp.status not in ('pending','approved') then raise exception 'Status tidak memungkinkan pembatalan.'; end if;
    new_status := 'cancelled';
  else
    raise exception 'Aksi tidak dikenal.';
  end if;

  update public.dispensations set status = new_status, reviewed_by = auth.uid(), reviewed_at = now(),
         review_note = coalesce(nullif(trim(p_note),''), review_note) where id = p_id;
  perform public.notify(dsp.requested_by, 'dispensation_'||p_action, 'Dispensasi ' || new_status::text, coalesce(p_note,''), '/dispensations/' || p_id);
  if dsp.supervisor_id <> dsp.requested_by then
    perform public.notify(dsp.supervisor_id, 'dispensation_'||p_action, 'Dispensasi ' || new_status::text, coalesce(p_note,''), '/dispensations/' || p_id);
  end if;
  return new_status;
end $$;

-- Persetujuan dispensasi BUKAN bukti partisipasi. Guru pendamping wajib mengonfirmasi.
create or replace function public.confirm_participation(p_dispensation_id uuid, p_student_id uuid, p_participated boolean)
returns void language plpgsql security definer set search_path = public as $$
declare dsp public.dispensations; d date; sid uuid; ex public.attendance_records; cls uuid;
begin
  select * into dsp from public.dispensations where id = p_dispensation_id for update;
  if not found then raise exception 'Dispensasi tidak ditemukan.'; end if;
  if not (dsp.supervisor_id = auth.uid() or public.is_admin()) then
    raise exception 'Hanya guru pendamping atau administrator yang dapat mengonfirmasi partisipasi.';
  end if;
  if dsp.status not in ('approved','completed') then raise exception 'Dispensasi belum disetujui.'; end if;
  if not exists (select 1 from public.dispensation_students where dispensation_id = dsp.id and student_id = p_student_id) then
    raise exception 'Siswa bukan peserta dispensasi ini.';
  end if;

  update public.dispensation_students
     set participation = case when p_participated then 'participated' else 'not_participated' end::public.participation_status,
         needs_review = not p_participated, confirmed_by = auth.uid(), confirmed_at = now()
   where dispensation_id = dsp.id and student_id = p_student_id;

  if p_participated then
    select a.class_id into cls from public.student_class_assignments a where a.student_id = p_student_id and a.end_date is null limit 1;
    for d in select generate_series(
        (dsp.starts_at at time zone coalesce(public.get_setting('school.timezone','"Asia/Jakarta"') #>> '{}','Asia/Jakarta'))::date,
        (dsp.ends_at   at time zone coalesce(public.get_setting('school.timezone','"Asia/Jakarta"') #>> '{}','Asia/Jakarta'))::date,
        interval '1 day')::date loop
      if not public.is_school_day(d) then continue; end if;
      sid := public.ensure_attendance_session(d);
      select * into ex from public.attendance_records where session_id = sid and student_id = p_student_id for update;
      if not found then
        insert into public.attendance_records(session_id, student_id, class_id, status, source, recorded_by, dispensation_id, note)
        values (sid, p_student_id, cls, 'official_activity', 'dispensation', auth.uid(), dsp.id, dsp.name);
      elsif ex.status in ('unverified','unexcused') then
        insert into public.attendance_corrections(record_id, previous_status, new_status, reason, corrected_by)
        values (ex.id, ex.status, 'official_activity', 'Partisipasi dispensasi dikonfirmasi: ' || dsp.name, auth.uid());
        update public.attendance_records set status = 'official_activity', source = 'dispensation', dispensation_id = dsp.id where id = ex.id;
      end if;   -- hadir/terlambat tidak ditimpa
    end loop;
  end if;
  perform public.write_audit('confirm_participation','dispensation_students', p_dispensation_id::text, null,
    jsonb_build_object('student_id',p_student_id,'participated',p_participated));
end $$;

create or replace function public.complete_dispensation(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare dsp public.dispensations;
begin
  select * into dsp from public.dispensations where id = p_id for update;
  if not found then raise exception 'Dispensasi tidak ditemukan.'; end if;
  if not (dsp.supervisor_id = auth.uid() or public.is_admin()) then raise exception 'Tidak berwenang.'; end if;
  if dsp.status <> 'approved' then raise exception 'Hanya dispensasi yang disetujui yang dapat diselesaikan.'; end if;
  update public.dispensation_students set needs_review = true where dispensation_id = p_id and participation = 'unconfirmed';
  update public.dispensations set status = 'completed' where id = p_id;
end $$;

-- ================================================================ Pulang lebih awal
create or replace function public.review_dismissal(
  p_id uuid, p_action text, p_note text default null, p_requester_verified boolean default false, p_verification_note text default null
) returns public.dismissal_status
language plpgsql security definer set search_path = public as $$
declare r public.early_dismissal_requests; new_status public.dismissal_status;
begin
  if not public.is_approver() then raise exception 'Anda tidak berwenang meninjau permintaan pulang awal.'; end if;
  select * into r from public.early_dismissal_requests where id = p_id for update;
  if not found then raise exception 'Permintaan tidak ditemukan.'; end if;
  if r.status <> 'pending' and p_action <> 'cancel' then raise exception 'Hanya permintaan berstatus Menunggu yang dapat diputuskan.'; end if;

  if p_action = 'approve' then
    if not p_requester_verified or coalesce(length(trim(p_verification_note)),0) < 3 then
      raise exception 'Identitas pemohon harus diverifikasi dan dicatat sebelum persetujuan.';
    end if;
    new_status := 'approved';
  elsif p_action = 'reject' then
    if coalesce(length(trim(p_note)),0) < 3 then raise exception 'Alasan penolakan wajib diisi.'; end if;
    new_status := 'rejected';
  elsif p_action = 'cancel' then
    if r.status not in ('pending','approved') then raise exception 'Status tidak memungkinkan pembatalan.'; end if;
    new_status := 'cancelled';
  else
    raise exception 'Aksi tidak dikenal.';
  end if;

  update public.early_dismissal_requests
     set status = new_status, reviewed_by = auth.uid(), reviewed_at = now(),
         review_note = nullif(trim(p_note),''),
         requester_verified = case when p_action='approve' then true else requester_verified end,
         requester_verification_note = case when p_action='approve' then trim(p_verification_note) else requester_verification_note end
   where id = p_id;
  return new_status;
end $$;

-- Serah terima nyata. Persetujuan saja TIDAK berarti siswa sudah pulang, dan QR tidak berperan di sini.
create or replace function public.complete_handover(
  p_request_id uuid,
  p_outcome public.handover_outcome,
  p_actual_name text,
  p_actual_relation text,
  p_identity_document text,
  p_matches_authorized boolean,
  p_note text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare r public.early_dismissal_requests;
begin
  if not public.is_staff() then
    raise exception 'Hanya staf sekolah yang dapat mencatat serah terima.';
  end if;
  select * into r from public.early_dismissal_requests where id = p_request_id for update;
  if not found then raise exception 'Permintaan tidak ditemukan.'; end if;
  if r.status <> 'approved' then raise exception 'Serah terima hanya dapat dicatat untuk permintaan yang sudah disetujui.'; end if;
  if exists (select 1 from public.early_dismissal_handover_logs where request_id = p_request_id and outcome = 'handed_over') then
    raise exception 'Serah terima untuk permintaan ini sudah dicatat.';
  end if;

  if p_outcome = 'handed_over' and not p_matches_authorized then
    raise exception 'Penjemput tidak cocok dengan yang diizinkan. Siswa tetap dalam pengawasan sekolah.';
  end if;

  insert into public.early_dismissal_handover_logs(
    request_id, outcome, actual_pickup_name, actual_pickup_relation, identity_document,
    matches_authorized, verification_note, handed_over_at, responsible_staff_id)
  values (
    p_request_id, p_outcome, trim(p_actual_name), trim(p_actual_relation), trim(p_identity_document),
    p_matches_authorized, nullif(trim(p_note),''),
    case when p_outcome = 'handed_over' then now() end, auth.uid());

  if p_outcome = 'handed_over' then
    update public.early_dismissal_requests set status = 'completed' where id = p_request_id;
  end if;
end $$;

-- ================================================================ Pengaturan awal (non-rahasia)
insert into public.system_settings(key, value) values
  ('school.name', '"SDN PANDIAN 1 SUMENEP"'),
  ('school.address', '""'),
  ('school.phone', '""'),
  ('school.timezone', '"Asia/Jakarta"'),
  ('attendance.start_time', '"07:00"'),
  ('attendance.late_after', '"07:15"'),
  ('attendance.close_time', '"09:00"'),
  ('attendance.school_days', '[1,2,3,4,5]'),
  ('permission.document_required_for_sick_days', '3')
on conflict (key) do nothing;
