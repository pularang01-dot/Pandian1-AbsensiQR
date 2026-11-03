-- PANDIAN SMART ATTENDANCE - Migrasi 003: Row Level Security
-- Prinsip: tolak secara default. Tidak ada akses untuk anon. Penulisan data sensitif lewat RPC (002).

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','user_roles','academic_years','classes','students','student_class_assignments','parents',
    'parent_student_links','student_qr_tokens','school_calendar','system_settings','attendance_sessions',
    'attendance_records','attendance_corrections','permission_requests','permission_documents',
    'permission_request_events','dispensations','dispensation_students','early_dismissal_requests',
    'early_dismissal_handover_logs','notifications','audit_logs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- profiles & roles
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());
create policy profiles_admin_write on public.profiles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy user_roles_select on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy user_roles_super_write on public.user_roles for all to authenticated
  using (public.has_role('super_admin')) with check (public.has_role('super_admin'));

-- ---------------------------------------------------------------- referensi (tidak sensitif)
create policy academic_years_select on public.academic_years for select to authenticated using (true);
create policy academic_years_write on public.academic_years for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy classes_select on public.classes for select to authenticated using (true);
create policy classes_write on public.classes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy calendar_select on public.school_calendar for select to authenticated using (true);
create policy calendar_write on public.school_calendar for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Pengaturan hanya berisi nilai non-rahasia (nama sekolah, jam absensi).
create policy settings_select on public.system_settings for select to authenticated using (true);
create policy settings_write on public.system_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------- siswa
create policy students_select on public.students for select to authenticated
  using (public.can_view_student(id));
create policy students_insert on public.students for insert to authenticated with check (public.is_admin());
create policy students_update on public.students for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- Tidak ada kebijakan DELETE: siswa dinonaktifkan, bukan dihapus.

create policy sca_select on public.student_class_assignments for select to authenticated
  using (public.can_view_student(student_id));
create policy sca_write on public.student_class_assignments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy parents_select on public.parents for select to authenticated
  using (profile_id = auth.uid() or public.is_approver());
create policy parents_write on public.parents for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy psl_select on public.parent_student_links for select to authenticated
  using (
    public.is_approver()
    or exists (select 1 from public.parents pa where pa.id = parent_id and pa.profile_id = auth.uid())
  );
create policy psl_write on public.parent_student_links for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Token QR: hanya administrator yang dapat membaca; pemindaian lewat RPC.
create policy qr_select on public.student_qr_tokens for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------- absensi
create policy sessions_select on public.attendance_sessions for select to authenticated using (public.is_staff());

create policy attendance_select on public.attendance_records for select to authenticated
  using (public.can_view_student(student_id));
-- INSERT/UPDATE/DELETE langsung tidak diizinkan; gunakan record_attendance / correct_attendance.

create policy corrections_select on public.attendance_corrections for select to authenticated
  using (
    public.is_approver()
    or (public.has_role('teacher') and exists (
      select 1 from public.attendance_records r where r.id = record_id and public.teaches_student(r.student_id)))
  );

-- ---------------------------------------------------------------- izin
create policy pr_select on public.permission_requests for select to authenticated
  using (
    public.is_approver() or public.has_role('operator')
    or (public.has_role('teacher') and public.teaches_student(student_id))
    or requested_by = auth.uid()
    or public.is_parent_of(student_id)
  );
create policy pr_insert_parent on public.permission_requests for insert to authenticated
  with check (requested_by = auth.uid() and public.is_parent_of(student_id) and status = 'pending' and not entered_manually);
create policy pr_insert_staff on public.permission_requests for insert to authenticated
  with check (public.is_admin() and status = 'pending');
-- Pengaju hanya dapat membatalkan; dijaga trigger permission_guard_update.
create policy pr_update_owner on public.permission_requests for update to authenticated
  using (requested_by = auth.uid()) with check (requested_by = auth.uid());

create policy pd_select on public.permission_documents for select to authenticated
  using (exists (select 1 from public.permission_requests r where r.id = request_id
                 and (public.is_approver() or public.is_parent_of(r.student_id) or r.requested_by = auth.uid())));
create policy pd_insert on public.permission_documents for insert to authenticated
  with check (uploaded_by = auth.uid() and exists (
    select 1 from public.permission_requests r where r.id = request_id
      and (r.requested_by = auth.uid() or public.is_admin())));

create policy pre_select on public.permission_request_events for select to authenticated
  using (public.is_staff());

-- ---------------------------------------------------------------- dispensasi
create policy disp_select on public.dispensations for select to authenticated
  using (
    public.is_staff()
    or exists (select 1 from public.dispensation_students ds
               where ds.dispensation_id = public.dispensations.id and public.is_parent_of(ds.student_id))
  );
create policy disp_insert on public.dispensations for insert to authenticated
  with check (
    requested_by = auth.uid() and status = 'pending' and reviewed_by is null
    and (public.is_admin() or public.has_role('principal') or public.has_role('teacher'))
  );
-- Pengaju hanya dapat mengubah usulan yang masih menunggu; keputusan lewat review_dispensation.
create policy disp_update on public.dispensations for update to authenticated
  using ((requested_by = auth.uid() and status = 'pending') or public.is_admin())
  with check (status = 'pending' and reviewed_by is null);

create policy ds_select on public.dispensation_students for select to authenticated
  using (public.is_staff() or public.is_parent_of(student_id));
create policy ds_insert on public.dispensation_students for insert to authenticated
  with check (
    participation = 'unconfirmed' and not needs_review
    and exists (select 1 from public.dispensations d where d.id = dispensation_id and d.status = 'pending'
                and (d.requested_by = auth.uid() or public.is_admin()))
  );
create policy ds_delete on public.dispensation_students for delete to authenticated
  using (exists (select 1 from public.dispensations d where d.id = dispensation_id and d.status = 'pending'
                 and (d.requested_by = auth.uid() or public.is_admin())));

-- ---------------------------------------------------------------- pulang lebih awal
create policy edr_select on public.early_dismissal_requests for select to authenticated
  using (public.is_staff() or requested_by = auth.uid() or public.is_parent_of(student_id));
create policy edr_insert_parent on public.early_dismissal_requests for insert to authenticated
  with check (requested_by = auth.uid() and public.is_parent_of(student_id)
              and status = 'pending' and not requester_verified and reviewed_by is null);
create policy edr_insert_staff on public.early_dismissal_requests for insert to authenticated
  with check (public.is_staff() and requested_by = auth.uid()
              and status = 'pending' and not requester_verified and reviewed_by is null);
-- Tidak ada UPDATE langsung: gunakan review_dismissal dan complete_handover.

create policy edh_select on public.early_dismissal_handover_logs for select to authenticated
  using (public.is_staff() or exists (
    select 1 from public.early_dismissal_requests r where r.id = request_id and public.is_parent_of(r.student_id)));

-- ---------------------------------------------------------------- notifikasi & audit
create policy notif_select on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notif_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notif_delete on public.notifications for delete to authenticated using (user_id = auth.uid());

create policy audit_select on public.audit_logs for select to authenticated using (public.is_approver());
-- Tidak ada kebijakan tulis/ubah/hapus pada audit_logs.

-- ---------------------------------------------------------------- Hak akses
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from public, anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

-- Tabel yang tidak boleh ditulis langsung oleh klien (hanya lewat RPC/trigger).
revoke insert, update, delete on public.attendance_records, public.attendance_corrections,
  public.attendance_sessions, public.student_qr_tokens, public.audit_logs,
  public.permission_request_events, public.early_dismissal_handover_logs from authenticated;
revoke delete on public.students, public.audit_logs, public.permission_requests,
  public.dispensations, public.early_dismissal_requests from authenticated;
revoke update on public.early_dismissal_requests, public.dispensation_students from authenticated;

-- Fungsi internal: tidak boleh dipanggil langsung oleh pengguna.
revoke execute on function
  public.write_audit(text,text,text,jsonb,jsonb,text),
  public.notify(uuid,text,text,text,text),
  public.notify_role(public.app_role,text,text,text,text),
  public.ensure_attendance_session(date),
  public.audit_row(), public.set_updated_at(), public.handle_new_user(),
  public.permission_before_insert(), public.permission_guard_update(), public.permission_after_insert(),
  public.bootstrap_super_admin(text)
from authenticated;

-- Fungsi baru di masa depan: ingat untuk selalu REVOKE dari public/anon (lihat docs/DATABASE_SCHEMA.md).
alter default privileges in schema public revoke execute on functions from public, anon;
