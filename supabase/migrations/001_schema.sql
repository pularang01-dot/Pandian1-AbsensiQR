-- PANDIAN SMART ATTENDANCE - Migrasi 001: skema dasar
-- Jalankan berurutan: 001 -> 002 -> 003 -> 004 di Supabase SQL Editor.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- Enum
create type public.app_role as enum ('super_admin','school_admin','principal','teacher','operator','parent');
create type public.student_status as enum ('active','transferred','graduated','inactive');
create type public.attendance_status as enum ('present','late','sick','permission','official_activity','unexcused','unverified');
create type public.attendance_source as enum ('qr','manual','permission','dispensation','system');
create type public.request_status as enum ('pending','under_review','needs_clarification','approved','rejected','cancelled');
create type public.permission_category as enum ('sick','permission');
create type public.dispensation_status as enum ('pending','approved','rejected','cancelled','completed');
create type public.participation_status as enum ('unconfirmed','participated','not_participated');
create type public.dismissal_status as enum ('pending','approved','rejected','cancelled','completed');
create type public.handover_outcome as enum ('handed_over','verification_failed');
create type public.calendar_kind as enum ('holiday','special_activity','extra_school_day');

-- ---------------------------------------------------------------- Utilitas
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------- Pengguna
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 2 and 150),
  phone text check (phone is null or char_length(phone) <= 30),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);
create index user_roles_role_idx on public.user_roles(role);

-- ---------------------------------------------------------------- Akademik
create table public.academic_years (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,                -- contoh: 2026/2027
  start_date date not null,
  end_date date not null,
  is_active boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date > start_date)
);
-- Hanya satu tahun ajaran aktif.
create unique index academic_years_one_active on public.academic_years(is_active) where is_active;

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years(id),
  name text not null check (char_length(trim(name)) between 1 and 50),
  grade_level smallint check (grade_level between 1 and 6),
  homeroom_teacher_id uuid references public.profiles(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academic_year_id, name)
);
create index classes_year_idx on public.classes(academic_year_id);
create index classes_teacher_idx on public.classes(homeroom_teacher_id);

-- ---------------------------------------------------------------- Siswa
create table public.students (
  id uuid primary key default gen_random_uuid(),
  nis text not null unique check (char_length(nis) between 1 and 30),
  nisn text unique check (nisn is null or char_length(nisn) between 5 and 20),
  full_name text not null check (char_length(trim(full_name)) between 2 and 150),
  gender text check (gender in ('L','P')),
  status public.student_status not null default 'active',
  is_demo boolean not null default false,   -- penanda data demonstrasi
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index students_status_idx on public.students(status);
create index students_name_idx on public.students using btree (lower(full_name));

create table public.student_class_assignments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id),
  class_id uuid not null references public.classes(id),
  academic_year_id uuid not null references public.academic_years(id),
  start_date date not null default current_date,
  end_date date,
  created_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);
-- Satu penempatan kelas terbuka per siswa per tahun ajaran.
create unique index sca_one_open on public.student_class_assignments(student_id, academic_year_id) where end_date is null;
create index sca_class_idx on public.student_class_assignments(class_id) where end_date is null;
create index sca_student_idx on public.student_class_assignments(student_id);

create table public.parents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.parent_student_links (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.parents(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  relationship text not null check (relationship in ('ayah','ibu','wali')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (parent_id, student_id)
);
create index psl_student_idx on public.parent_student_links(student_id);

-- Token QR: acak, tidak bermakna, dapat dicabut. Tidak memuat data pribadi.
create table public.student_qr_tokens (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  token text not null unique check (char_length(token) >= 32),
  is_active boolean not null default true,
  issued_by uuid references public.profiles(id),
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id)
);
create unique index qr_one_active on public.student_qr_tokens(student_id) where is_active;

-- ---------------------------------------------------------------- Kalender & pengaturan
create table public.school_calendar (
  id uuid primary key default gen_random_uuid(),
  calendar_date date not null,
  kind public.calendar_kind not null,
  description text not null check (char_length(description) between 1 and 200),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (calendar_date, kind)
);
create index school_calendar_date_idx on public.school_calendar(calendar_date);

create table public.system_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- Absensi
create table public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  session_date date not null unique,
  label text not null default 'Absensi Harian',
  start_time time not null,
  late_after time not null,
  close_time time not null,
  status text not null default 'open' check (status in ('open','closed')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (late_after >= start_time and close_time >= late_after)
);

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.attendance_sessions(id),
  student_id uuid not null references public.students(id),
  class_id uuid references public.classes(id),
  status public.attendance_status not null,
  source public.attendance_source not null,
  checked_in_at timestamptz,
  recorded_by uuid references public.profiles(id),
  qr_token_id uuid references public.student_qr_tokens(id),
  permission_request_id uuid,
  dispensation_id uuid,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, student_id)       -- mencegah absensi ganda
);
create index ar_student_idx on public.attendance_records(student_id);
create index ar_session_status_idx on public.attendance_records(session_id, status);
create index ar_class_idx on public.attendance_records(class_id);

create table public.attendance_corrections (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.attendance_records(id),
  previous_status public.attendance_status not null,
  new_status public.attendance_status not null,
  reason text not null check (char_length(trim(reason)) >= 5),
  corrected_by uuid not null references public.profiles(id),
  corrected_at timestamptz not null default now()
);
create index ac_record_idx on public.attendance_corrections(record_id);

-- ---------------------------------------------------------------- Izin
create table public.permission_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id),
  requested_by uuid not null references public.profiles(id),
  entered_manually boolean not null default false,  -- dicatat sekolah atas nama orang tua
  category public.permission_category not null,
  start_date date not null,
  end_date date not null,
  reason text not null check (char_length(trim(reason)) between 3 and 500),
  status public.request_status not null default 'pending',
  is_retrospective boolean not null default false,
  review_note text check (review_note is null or char_length(review_note) <= 500),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date),
  check (end_date - start_date <= 30)
);
create index pr_student_idx on public.permission_requests(student_id);
create index pr_status_idx on public.permission_requests(status);
create index pr_dates_idx on public.permission_requests(start_date, end_date);

create table public.permission_documents (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.permission_requests(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png')),
  size_bytes integer not null check (size_bytes between 1 and 5242880),
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index pd_request_idx on public.permission_documents(request_id);

create table public.permission_request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.permission_requests(id) on delete cascade,
  action text not null,
  actor_id uuid references public.profiles(id),
  note text,
  created_at timestamptz not null default now()
);
create index pre_request_idx on public.permission_request_events(request_id);

-- ---------------------------------------------------------------- Dispensasi
create table public.dispensations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 3 and 200),
  category text not null check (category in ('lomba_akademik','lomba_olahraga','budaya','delegasi_sekolah','lainnya')),
  location text check (location is null or char_length(location) <= 200),
  description text check (description is null or char_length(description) <= 1000),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  supervisor_id uuid not null references public.profiles(id),
  requested_by uuid not null references public.profiles(id),
  status public.dispensation_status not null default 'pending',
  review_note text check (review_note is null or char_length(review_note) <= 500),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at >= starts_at)
);
create index disp_status_idx on public.dispensations(status);
create index disp_dates_idx on public.dispensations(starts_at, ends_at);

create table public.dispensation_students (
  id uuid primary key default gen_random_uuid(),
  dispensation_id uuid not null references public.dispensations(id) on delete cascade,
  student_id uuid not null references public.students(id),
  participation public.participation_status not null default 'unconfirmed',
  needs_review boolean not null default false,
  confirmed_by uuid references public.profiles(id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (dispensation_id, student_id)
);
create index ds_student_idx on public.dispensation_students(student_id);

-- ---------------------------------------------------------------- Pulang lebih awal
create table public.early_dismissal_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id),
  requested_by uuid not null references public.profiles(id),
  requester_relation text not null check (char_length(requester_relation) between 2 and 50),
  reason text not null check (char_length(trim(reason)) between 3 and 500),
  requested_time timestamptz not null,
  authorized_pickup_name text not null check (char_length(trim(authorized_pickup_name)) >= 2),
  authorized_pickup_relation text not null check (char_length(trim(authorized_pickup_relation)) >= 2),
  requester_verified boolean not null default false,
  requester_verification_note text,
  status public.dismissal_status not null default 'pending',
  review_note text check (review_note is null or char_length(review_note) <= 500),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index edr_student_idx on public.early_dismissal_requests(student_id);
create index edr_status_idx on public.early_dismissal_requests(status);

-- Serah terima nyata. Terpisah dari persetujuan: persetujuan BUKAN bukti siswa sudah pulang.
create table public.early_dismissal_handover_logs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.early_dismissal_requests(id),
  outcome public.handover_outcome not null,
  actual_pickup_name text not null check (char_length(trim(actual_pickup_name)) >= 2),
  actual_pickup_relation text not null check (char_length(trim(actual_pickup_relation)) >= 2),
  identity_document text not null check (char_length(trim(identity_document)) >= 2),
  matches_authorized boolean not null,
  verification_note text,
  handed_over_at timestamptz,
  responsible_staff_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  -- Serah terima hanya sah bila identitas cocok dengan penjemput resmi.
  check (outcome <> 'handed_over' or (matches_authorized and handed_over_at is not null))
);
-- Percobaan verifikasi yang gagal boleh berulang (tiap percobaan tercatat),
-- tetapi serah terima yang berhasil hanya sekali per permintaan.
create unique index edh_one_success on public.early_dismissal_handover_logs(request_id) where outcome = 'handed_over';
create index edh_request_idx on public.early_dismissal_handover_logs(request_id);

-- ---------------------------------------------------------------- Notifikasi & audit
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notif_user_idx on public.notifications(user_id, is_read, created_at desc);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity_table text not null,
  entity_id text,
  old_data jsonb,
  new_data jsonb,
  reason text,
  created_at timestamptz not null default now()
);
create index audit_entity_idx on public.audit_logs(entity_table, entity_id);
create index audit_created_idx on public.audit_logs(created_at desc);

-- ---------------------------------------------------------------- Trigger updated_at
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','academic_years','classes','students','parents','attendance_sessions',
    'attendance_records','permission_requests','dispensations','early_dismissal_requests'
  ] loop
    execute format('create trigger trg_%1$s_updated before update on public.%1$s
                    for each row execute function public.set_updated_at()', t);
  end loop;
end $$;
