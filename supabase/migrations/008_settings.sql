-- PANDIAN SMART ATTENDANCE - Migrasi 008: pengaturan (tahun ajaran atomik)

-- Mengaktifkan satu tahun ajaran dan menonaktifkan yang lain dalam satu transaksi
-- (indeks unik parsial hanya mengizinkan satu tahun ajaran aktif).
create or replace function public.activate_academic_year(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare y public.academic_years;
begin
  if not public.is_admin() then raise exception 'Anda tidak berwenang mengubah tahun ajaran.'; end if;
  select * into y from public.academic_years where id = p_id for update;
  if not found then raise exception 'Tahun ajaran tidak ditemukan.'; end if;
  if y.is_archived then raise exception 'Tahun ajaran yang diarsipkan tidak dapat diaktifkan.'; end if;
  update public.academic_years set is_active = false where is_active and id <> p_id;
  update public.academic_years set is_active = true where id = p_id;
end $$;

-- Mengarsipkan tahun ajaran. Tahun ajaran aktif tidak dapat diarsipkan; data lama tetap tersimpan.
create or replace function public.archive_academic_year(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare y public.academic_years;
begin
  if not public.is_admin() then raise exception 'Anda tidak berwenang mengubah tahun ajaran.'; end if;
  select * into y from public.academic_years where id = p_id for update;
  if not found then raise exception 'Tahun ajaran tidak ditemukan.'; end if;
  if y.is_active then raise exception 'Nonaktifkan tahun ajaran ini (aktifkan yang lain) sebelum mengarsipkan.'; end if;
  update public.academic_years set is_archived = true where id = p_id;
end $$;

revoke execute on function public.activate_academic_year(uuid), public.archive_academic_year(uuid) from public, anon;
grant execute on function public.activate_academic_year(uuid), public.archive_academic_year(uuid) to authenticated;
