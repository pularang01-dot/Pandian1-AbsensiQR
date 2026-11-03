-- PANDIAN SMART ATTENDANCE - Migrasi 007: pembuatan dispensasi atomik dan notifikasi pulang lebih awal

-- Membuat dispensasi beserta pesertanya dalam satu transaksi.
-- Guru hanya boleh memasukkan siswa kelas yang diampu; administrator/kepala sekolah boleh lintas kelas.
create or replace function public.create_dispensation(
  p_name text, p_category text, p_location text, p_description text,
  p_starts timestamptz, p_ends timestamptz, p_supervisor uuid, p_students uuid[]
) returns uuid
language plpgsql security definer set search_path = public as $$
declare did uuid; s uuid; broad boolean := public.is_admin() or public.has_role('principal');
begin
  if not (broad or public.has_role('teacher')) then raise exception 'Anda tidak berwenang mengajukan dispensasi.'; end if;
  if p_students is null or coalesce(array_length(p_students,1),0) = 0 then raise exception 'Pilih minimal satu siswa peserta.'; end if;
  if array_length(p_students,1) > 200 then raise exception 'Maksimal 200 siswa per dispensasi.'; end if;
  if p_ends < p_starts then raise exception 'Waktu selesai tidak boleh sebelum waktu mulai.'; end if;
  if not exists (
    select 1 from public.user_roles ur join public.profiles p on p.id = ur.user_id
    where ur.user_id = p_supervisor and p.is_active and ur.role in ('teacher','principal','school_admin','super_admin')
  ) then raise exception 'Guru pendamping tidak valid.'; end if;

  foreach s in array p_students loop
    if not exists (select 1 from public.students where id = s and status = 'active') then
      raise exception 'Ada siswa yang tidak ditemukan atau tidak aktif.';
    end if;
    if not broad and not public.teaches_student(s) then
      raise exception 'Anda hanya dapat memilih siswa dari kelas yang Anda ampu.';
    end if;
  end loop;

  insert into public.dispensations(name, category, location, description, starts_at, ends_at, supervisor_id, requested_by, status)
  values (trim(p_name), p_category, nullif(trim(p_location),''), nullif(trim(p_description),''), p_starts, p_ends, p_supervisor, auth.uid(), 'pending')
  returning id into did;

  insert into public.dispensation_students(dispensation_id, student_id)
  select did, x from (select distinct unnest(p_students) as x) q;

  perform public.notify_role('principal','dispensation_new','Pengajuan dispensasi baru', trim(p_name), '/dispensations/' || did);
  perform public.notify_role('school_admin','dispensation_new','Pengajuan dispensasi baru', trim(p_name), '/dispensations/' || did);
  return did;
end $$;

revoke execute on function public.create_dispensation(text,text,text,text,timestamptz,timestamptz,uuid,uuid[]) from public, anon;
grant execute on function public.create_dispensation(text,text,text,text,timestamptz,timestamptz,uuid,uuid[]) to authenticated;

-- Notifikasi untuk permintaan pulang lebih awal baru.
create or replace function public.dismissal_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_role('principal','dismissal_new','Permintaan pulang lebih awal','Perlu verifikasi pemohon dan peninjauan.','/early-dismissal/' || new.id);
  perform public.notify_role('school_admin','dismissal_new','Permintaan pulang lebih awal','Perlu verifikasi pemohon dan peninjauan.','/early-dismissal/' || new.id);
  return new;
end $$;
create trigger trg_dismissal_after_insert after insert on public.early_dismissal_requests
  for each row execute function public.dismissal_after_insert();
revoke execute on function public.dismissal_after_insert() from public, anon, authenticated;
