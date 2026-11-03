-- PANDIAN SMART ATTENDANCE - Migrasi 006: penempatan kelas dan impor siswa (atomik)

-- Memindahkan/menempatkan siswa ke kelas. Riwayat penempatan lama ditutup, tidak dihapus.
create or replace function public.assign_student_class(p_student uuid, p_class uuid) returns void
language plpgsql security definer set search_path = public as $$
declare cls public.classes; cur public.student_class_assignments;
begin
  if not public.is_admin() then raise exception 'Hanya administrator yang dapat menempatkan siswa ke kelas.'; end if;
  select * into cls from public.classes where id = p_class;
  if not found or not cls.is_active then raise exception 'Kelas tidak ditemukan atau tidak aktif.'; end if;
  if not exists (select 1 from public.students where id = p_student and status = 'active') then
    raise exception 'Siswa tidak ditemukan atau tidak aktif.';
  end if;

  select * into cur from public.student_class_assignments
   where student_id = p_student and academic_year_id = cls.academic_year_id and end_date is null;
  if found then
    if cur.class_id = p_class then return; end if;
    update public.student_class_assignments set end_date = public.school_today() where id = cur.id;
  end if;
  insert into public.student_class_assignments(student_id, class_id, academic_year_id, start_date)
  values (p_student, p_class, cls.academic_year_id, public.school_today());
end $$;

-- Impor massal. Seluruh batch dalam satu transaksi. Baris bermasalah dilewati dan dilaporkan.
-- p_rows: [{nis, nisn, full_name, gender, class_name}]
create or replace function public.import_students(p_rows jsonb, p_year uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r jsonb; i int := 0; inserted int := 0; skipped jsonb := '[]'::jsonb;
  v_nis text; v_nisn text; v_name text; v_gender text; v_class text; cls uuid; sid uuid;
begin
  if not public.is_admin() then raise exception 'Hanya administrator yang dapat mengimpor siswa.'; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'Format data tidak valid.'; end if;
  if jsonb_array_length(p_rows) > 1000 then raise exception 'Maksimal 1000 baris per impor.'; end if;
  if not exists (select 1 from public.academic_years where id = p_year) then raise exception 'Tahun ajaran tidak valid.'; end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    i := i + 1;
    v_nis := nullif(trim(r->>'nis'), '');
    v_nisn := nullif(trim(r->>'nisn'), '');
    v_name := nullif(trim(r->>'full_name'), '');
    v_gender := upper(nullif(trim(r->>'gender'), ''));
    v_class := nullif(trim(r->>'class_name'), '');
    cls := null;

    if v_nis is null or v_name is null then
      skipped := skipped || jsonb_build_object('row', i, 'nis', v_nis, 'reason', 'NIS dan nama wajib diisi'); continue;
    end if;
    if length(v_name) < 2 or length(v_name) > 150 or length(v_nis) > 30 then
      skipped := skipped || jsonb_build_object('row', i, 'nis', v_nis, 'reason', 'Panjang NIS atau nama tidak valid'); continue;
    end if;
    if v_gender is not null and v_gender not in ('L','P') then
      skipped := skipped || jsonb_build_object('row', i, 'nis', v_nis, 'reason', 'Jenis kelamin harus L atau P'); continue;
    end if;
    if v_nisn is not null and v_nisn !~ '^[0-9]{5,20}$' then
      skipped := skipped || jsonb_build_object('row', i, 'nis', v_nis, 'reason', 'NISN harus 5-20 digit angka'); continue;
    end if;
    if exists (select 1 from public.students where nis = v_nis) then
      skipped := skipped || jsonb_build_object('row', i, 'nis', v_nis, 'reason', 'NIS sudah terdaftar'); continue;
    end if;
    if v_nisn is not null and exists (select 1 from public.students where nisn = v_nisn) then
      skipped := skipped || jsonb_build_object('row', i, 'nis', v_nis, 'reason', 'NISN sudah terdaftar'); continue;
    end if;
    if v_class is not null then
      select id into cls from public.classes where academic_year_id = p_year and lower(name) = lower(v_class) and is_active;
      if cls is null then
        skipped := skipped || jsonb_build_object('row', i, 'nis', v_nis, 'reason', 'Kelas "' || v_class || '" tidak ditemukan'); continue;
      end if;
    end if;

    insert into public.students(nis, nisn, full_name, gender) values (v_nis, v_nisn, v_name, v_gender) returning id into sid;
    if cls is not null then
      insert into public.student_class_assignments(student_id, class_id, academic_year_id, start_date) values (sid, cls, p_year, public.school_today());
    end if;
    insert into public.student_qr_tokens(student_id, token, issued_by) values (sid, encode(gen_random_bytes(24), 'hex'), auth.uid());
    inserted := inserted + 1;
  end loop;

  perform public.write_audit('import_students', 'students', null, null, jsonb_build_object('inserted', inserted, 'skipped', jsonb_array_length(skipped)));
  return jsonb_build_object('inserted', inserted, 'skipped', skipped);
end $$;

revoke execute on function public.assign_student_class(uuid,uuid), public.import_students(jsonb,uuid) from public, anon;
grant execute on function public.assign_student_class(uuid,uuid), public.import_students(jsonb,uuid) to authenticated;
