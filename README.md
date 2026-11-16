# Techtonics Club – Member ID Cards

A responsive site for the **Techtonics Club at Iqra University**. Members fill in their details, watch a live preview of their ID card, and submit it. **Members can't download the card.** Only the signed-in admin can export cards (PNG / ZIP) and data (CSV).

Stack: plain HTML, CSS and JavaScript, with [Supabase](https://supabase.com) (Postgres, Storage and Auth) loaded through the `supabase-js` CDN. Exports use `html2canvas` and `JSZip`, and only `admin.html` loads them.

```
index.html   – member submission page (no download/export code)
admin.html   – admin dashboard (Supabase Auth login gate)
style.css    – shared styles, including the ID card design
script.js    – shared TechCard component + member page logic
admin.js     – admin table, edit/delete, PNG/ZIP/CSV export
config.js    – your Supabase URL + anon key
assets/      – techtonics-logo.jpeg, iqra-university-logo.png
```

---

## 1. Create a Supabase project

1. Go to <https://supabase.com>, create a project and wait for it to finish provisioning.
2. Open **Project Settings → API** and copy:
   - **Project URL**
   - **anon public** key
3. Paste both into `config.js`:

```js
SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
SUPABASE_ANON_KEY: "eyJhbGciOi...",
```

> ⚠️ Never put the `service_role` key in `config.js`. The anon key is safe to expose only because of the policies below.

---

## 2. Create the admin user

1. **Authentication → Users → Add user → Create new user**: enter the admin email and a strong password, and tick **Auto Confirm User**.
2. **Authentication → Sign In / Providers → Email**: turn **off** "Allow new users to sign up". That way nobody else can create an account.
3. Remember the admin email. You'll paste it into the SQL in the next step.

---

## 3. Run this SQL (SQL Editor → New query → Run)

Configured for admin email `therealdanish10@gmail.com` (case-insensitive). You can also run the full script directly from `setup.sql`.

```sql
-- =========================================================
-- 3.1  Table
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
-- 3.2  Admin check
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
-- 3.3  Row-level security: public INSERT only
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
-- 3.4  Storage bucket "photos" (private, 3 MB, images only)
-- =========================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

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
```

### Bucket setup without SQL (alternative to section 3.4)

If you'd rather use the dashboard:

1. **Storage → New bucket**, name it `photos`.
2. Leave **Public bucket** **OFF** (photos stay private, and the admin views them through short-lived signed URLs).
3. Under **Additional configuration**, set the file size limit to **3 MB** and the allowed MIME types to `image/jpeg, image/png, image/webp`.
4. Create the four storage policies above, either from the SQL or under **Storage → Policies**.

### What these policies allow

| Action | Public (anon) | Admin (authenticated + `is_admin()`) |
| --- | --- | --- |
| INSERT submission / upload photo | ✅ | ✅ |
| SELECT (read) | ❌ | ✅ |
| UPDATE | ❌ | ✅ |
| DELETE | ❌ | ✅ |

> `photo_url` holds the storage **path** (for example `submissions/<uuid>.jpg`) in the private bucket, not a public link. The admin dashboard turns it into a signed URL. Because the public has no SELECT access, the member page inserts without `.select()`.

---

## 4. Run it locally

Serve the folder over **http**. Don't open the files with `file://`, because browsers block canvas export for local files.

```bash
# any of these, from the project folder
npx serve .
python -m http.server 8080
```

Or use the VS Code "Live Server" extension. Then open:

- `http://localhost:8080/index.html`: member page
- `http://localhost:8080/admin.html`: admin dashboard

## 5. Deploy

Upload the whole folder, including `assets/`, to any static host: Netlify, Vercel, GitHub Pages or Cloudflare Pages. No build step is needed.

---

## How it works

- **Live card preview (Front & Back)**: both sides of the card are built by `TechCard` in `script.js` (`TechCard.create()` and `TechCard.createBack()`) at a fixed design size of 324 × 516 px (54:86). They are scaled with a CSS transform to fit the screen and include a smooth **Front / Back** toggle above the preview on both the member page and the admin preview modal.
- **Static back side**: the back card features a top Techtonics green accent line, the centered Techtonics Club logo, the small-caps tagline *"Innovate. Collaborate. Create."*, a contact badge with an inline SVG phone icon (`Contact: +92 303 2888452`), a CSS-drawn signature line (*Authorized Signatory — President, Techtonics Club*), a property return notice, and the footer band (*Techtonics Club | Iqra University*).
- **Identical exports**: the admin page renders the **same components** off-screen and captures them with `html2canvas` at **3× scale** (972 × 1548 px). Before capture, each member photo is cropped to the frame's exact aspect ratio so the front PNG matches the on-screen `object-fit: cover`, and the static back PNG is rendered with the same `TechCard.createBack()` element.
- **Photos**: images are validated (image type, under 3 MB) and then resized in the browser to a maximum of 800 px (JPEG) before upload.
- **Duplicate protection**: after a successful submission, a `localStorage` flag locks the form in that browser. This is only a light deterrent, so the club still reviews every submission and can delete duplicates in the dashboard.
- **No member downloads**: `index.html` loads no export libraries and has no download, export or save code. Right-click and drag are disabled on the preview cards, and the preview images ignore pointer events. No website can stop someone from taking a screenshot, though.

## Admin dashboard

- Sign in with the admin email and password (Supabase Auth).
- Search by name, department, batch or designation, and filter by designation.
- Each row has:
  - **Preview Card**: opens a modal with a **Front / Back** toggle.
  - **Edit**: fix typos or update the designation.
  - **Delete**: removes the submission row and its photo from storage.
  - **Download PNG**: exports two 3× PNGs for that member (`[name]-front.png` and `[name]-back.png`).
- Bulk actions:
  - **Download all cards as ZIP**: includes both `[name]-front.png` and `[name]-back.png` (at 3× scale) for every member. If a search or filter is active, only the visible members' cards are exported.
  - **Export data as CSV**: UTF-8 with BOM, so it opens correctly in Excel.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| "Setup required" banner | Fill in `config.js`. |
| Admin sees "No submissions yet" but rows exist | The signed-in email isn't listed in `public.is_admin()`. Update the function and run it again. |
| "new row violates row-level security policy" on submit | Run all of section 3 again, including the storage policies. |
| PNG export fails / blank | Serve over http(s), not `file://`. |
