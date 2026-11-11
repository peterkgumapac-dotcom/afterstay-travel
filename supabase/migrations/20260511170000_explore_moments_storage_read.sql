-- Ensure Explore Moments media can be rendered by any signed-in viewer.
-- Feed rows are visible to authenticated users, so Storage reads stay private
-- and are served through signed URLs.

insert into storage.buckets (id, name, public)
values ('moments', 'moments', false)
on conflict (id) do update set public = false;

drop policy if exists "moments_storage_authenticated_read" on storage.objects;
create policy "moments_storage_authenticated_read" on storage.objects
for select
using (
  bucket_id = 'moments'
  and auth.role() = 'authenticated'
);
