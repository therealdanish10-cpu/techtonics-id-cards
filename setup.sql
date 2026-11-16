-- =========================================================
-- Techtonics Club – Supabase Database & Storage Setup
-- Paste this entire file into the Supabase SQL Editor and run it.
-- Safe to run multiple times (idempotent).
-- =========================================================

-- =========================================================
-- 1. Table: public.submissions
-- =========================================================
create table if not exists public.submissions (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null check (char_length(full_name)   between 2 and 60),
  department  text not null check (char_length(department)  between 1 and 60),
  batch       text not null check (char_length(batch)       between 1 and 30),
  designation text not null check (char_length(designation) between 1 and 40),
  photo_url   text not null check (char_length(photo_url)   between 1 and 300),
  created_at  timestamptz not null default now()
);

create index if not exists submissions_created_at_idx on public.submissions (created_at desc);

-- =========================================================
-- 2. Admin check function: public.is_admin()
-- =========================================================
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(lower(auth.jwt() ->> 'email'), '') = lower('therealdanish10@gmail.com');
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- =========================================================
-- 3. Row-level security & policies on public.submissions
-- =========================================================
alter table public.submissions enable row level security;

-- Privileges (defence in depth): the public may only insert these columns.
revoke all on public.submissions from anon, authenticated;
grant insert (full_name, department, batch, designation, photo_url)
  on public.submissions to anon, authenticated;
grant select, update, delete on public.submissions to authenticated;

drop policy if exists "Public can submit"  on public.submissions;
drop policy if exists "Admin can read"     on public.submissions;
drop policy if exists "Admin can update"   on public.submissions;
drop policy if exists "Admin can delete"   on public.submissions;

-- Anyone (anon or logged in) may INSERT a submission
create policy "Public can submit"
  on public.submissions for insert
  to anon, authenticated
  with check (photo_url like 'submissions/%');

-- Only the admin may SELECT / UPDATE / DELETE
create policy "Admin can read"
  on public.submissions for select
  to authenticated
  using (public.is_admin());

create policy "Admin can update"
  on public.submissions for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admin can delete"
  on public.submissions for delete
  to authenticated
  using (public.is_admin());

-- =========================================================
-- 4. Storage bucket "photos" (private, 3 MB, images only)
-- =========================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- =========================================================
-- 5. Storage policies on storage.objects for bucket "photos"
-- =========================================================
drop policy if exists "Public can upload photos" on storage.objects;
drop policy if exists "Admin can read photos"    on storage.objects;
drop policy if exists "Admin can update photos"  on storage.objects;
drop policy if exists "Admin can delete photos"  on storage.objects;

-- Anyone may upload (INSERT only) into photos/submissions/*.jpg
create policy "Public can upload photos"
  on storage.objects for insert
  to anon, authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = 'submissions'
    and lower(storage.extension(name)) = 'jpg'
  );

-- Only the admin may view / replace / delete photos
create policy "Admin can read photos"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'photos' and public.is_admin());

create policy "Admin can update photos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'photos' and public.is_admin())
  with check (bucket_id = 'photos' and public.is_admin());

create policy "Admin can delete photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'photos' and public.is_admin());
