-- PANDIAN SMART ATTENDANCE - Migrasi 004: penyimpanan dokumen pendukung (privat)
-- Bucket PRIVAT: dokumen tidak pernah memiliki URL publik. Akses lewat signed URL berumur pendek.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('permission-documents', 'permission-documents', false, 5242880,
        array['application/pdf','image/jpeg','image/png'])
on conflict (id) do update
  set public = false, file_size_limit = 5242880,
      allowed_mime_types = array['application/pdf','image/jpeg','image/png'];

-- Konvensi path: <request_id>/<nama-acak>.<ext>
-- Unggah: pengaju pengajuan tersebut (atau administrator).
create policy permission_docs_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'permission-documents'
    and exists (
      select 1 from public.permission_requests r
      where r.id::text = (storage.foldername(name))[1]
        and (r.requested_by = auth.uid() or public.is_admin())
    )
  );

-- Baca: pengaju, orang tua terhubung, atau penyetuju.
create policy permission_docs_select on storage.objects for select to authenticated
  using (
    bucket_id = 'permission-documents'
    and exists (
      select 1 from public.permission_requests r
      where r.id::text = (storage.foldername(name))[1]
        and (public.is_approver() or r.requested_by = auth.uid() or public.is_parent_of(r.student_id))
    )
  );

-- Tidak ada kebijakan UPDATE/DELETE: dokumen tidak dapat diubah atau dihapus klien.
-- Penghapusan sesuai kebijakan retensi dilakukan administrator database (lihat docs/SECURITY_AND_PRIVACY.md).
