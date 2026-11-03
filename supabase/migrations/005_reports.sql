-- PANDIAN SMART ATTENDANCE - Migrasi 005: fungsi ringkasan untuk dashboard dan laporan
-- Semua fungsi SECURITY INVOKER: hasil otomatis dibatasi RLS pengguna yang memanggil.
-- Agregasi dilakukan di database agar tidak terkena batas baris API dan konsisten di semua halaman.

create or replace function public.attendance_summary(p_from date, p_to date, p_class uuid default null)
returns table(session_date date, class_id uuid, status public.attendance_status, total bigint)
language sql stable security invoker set search_path = public as $$
  select s.session_date, r.class_id, r.status, count(*)::bigint
  from public.attendance_records r
  join public.attendance_sessions s on s.id = r.session_id
  where s.session_date between p_from and p_to
    and (p_class is null or r.class_id = p_class)
  group by s.session_date, r.class_id, r.status
$$;

-- Satu baris per siswa aktif; hitungan per status pada rentang tanggal.
-- school_days = jumlah sesi absensi pada rentang (hari libur tidak memiliki sesi sehingga tidak dihitung).
create or replace function public.student_attendance_summary(p_from date, p_to date, p_class uuid default null)
returns table(
  student_id uuid, nis text, full_name text, class_id uuid, class_name text,
  present bigint, late bigint, sick bigint, permission bigint,
  official_activity bigint, unexcused bigint, unverified bigint, school_days bigint
)
language sql stable security invoker set search_path = public as $$
  with sess as (
    select id from public.attendance_sessions where session_date between p_from and p_to
  )
  select
    st.id, st.nis, st.full_name, c.id, c.name,
    count(*) filter (where r.status = 'present'),
    count(*) filter (where r.status = 'late'),
    count(*) filter (where r.status = 'sick'),
    count(*) filter (where r.status = 'permission'),
    count(*) filter (where r.status = 'official_activity'),
    count(*) filter (where r.status = 'unexcused'),
    count(*) filter (where r.status = 'unverified'),
    (select count(*) from sess)::bigint
  from public.students st
  left join public.student_class_assignments a on a.student_id = st.id and a.end_date is null
  left join public.classes c on c.id = a.class_id
  left join public.attendance_records r on r.student_id = st.id and r.session_id in (select id from sess)
  where st.status = 'active' and (p_class is null or c.id = p_class)
  group by st.id, st.nis, st.full_name, c.id, c.name
  order by c.name nulls last, st.full_name
$$;

-- Jumlah siswa aktif per kelas (kelas null = belum ditempatkan).
create or replace function public.active_students_by_class(p_class uuid default null)
returns table(class_id uuid, total bigint)
language sql stable security invoker set search_path = public as $$
  select a.class_id, count(*)::bigint
  from public.students st
  left join public.student_class_assignments a on a.student_id = st.id and a.end_date is null
  where st.status = 'active' and (p_class is null or a.class_id = p_class)
  group by a.class_id
$$;

revoke execute on function public.attendance_summary(date,date,uuid),
  public.student_attendance_summary(date,date,uuid), public.active_students_by_class(uuid) from public, anon;
grant execute on function public.attendance_summary(date,date,uuid),
  public.student_attendance_summary(date,date,uuid), public.active_students_by_class(uuid) to authenticated;
