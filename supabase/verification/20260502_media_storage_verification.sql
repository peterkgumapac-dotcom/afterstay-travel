-- Run after 20260502_media_storage_stabilization.sql.

-- 1) Required insert policies exist.
select schemaname, tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('moments', 'personal_photos', 'feed_posts', 'post_media', 'trip_files')
  and cmd in ('INSERT', 'ALL')
order by tablename, policyname;

-- 2) Private trip-files bucket exists; moments bucket remains public for feed media.
select id, name, public
from storage.buckets
where id in ('moments', 'trip-files');

-- 3) Trip file metadata columns exist.
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'trip_files'
  and column_name in ('storage_path', 'content_type', 'size_bytes', 'uploaded_by')
order by column_name;

-- 4) Storage policies exist.
select schemaname, tablename, policyname, cmd
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname like 'trip_files_storage_%'
order by policyname;

-- 5) Check @test1 profile candidates. Replace the handle if needed.
select id, email, handle, full_name, created_at
from public.profiles
where lower(handle) in ('test1', '@test1')
   or email ilike '%test1%'
order by created_at desc;
