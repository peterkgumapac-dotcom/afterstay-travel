-- Backend cleanup verification for the May 2 media/new-user/Explore fixes.
-- Read-only: this should return rows describing what is present or missing.

-- 1) Migration history for the must-have backend fixes.
select
  'migration_history' as check_name,
  version,
  name,
  case
    when name in (
      'media_storage_stabilization',
      'onboarding_progress_state',
      'replace_trip_flights_rpc_v2',
      'moments_upload_write_policies',
      'public_profile_mvp'
    ) then 'required'
    else 'present'
  end as status
from supabase_migrations.schema_migrations
where name in (
  'media_storage_stabilization',
  'onboarding_progress_state',
  'replace_trip_flights_rpc_v2',
  'moments_upload_write_policies',
  'public_profile_mvp',
  'group_invite_admin_fixes',
  'backend_catchup_stabilization',
  'required_backend_stability_pack',
  'post_tags',
  'public_profile_lookup',
  'handle_availability_rpc',
  'profile_handle_upsert_rpc',
  'push_token_registration_rpc'
)
order by version;

-- 2) Required profile/new-user columns.
select
  'profile_columns' as check_name,
  column_name,
  data_type,
  column_default,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'
  and column_name in (
    'daily_tracker_enabled',
    'onboarding_state',
    'fcm_token',
    'expo_push_token',
    'push_provider',
    'push_enabled',
    'notification_prefs',
    'companion_privacy',
    'bio',
    'home_base',
    'profile_visibility',
    'public_stats_enabled',
    'profile_badges'
  )
order by column_name;

-- 3) Media buckets.
select
  'storage_buckets' as check_name,
  id,
  name,
  public
from storage.buckets
where id in ('moments', 'trip-files')
order by id;

-- 4) Trip files metadata columns.
select
  'trip_file_columns' as check_name,
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'trip_files'
  and column_name in ('storage_path', 'content_type', 'size_bytes', 'uploaded_by')
order by column_name;

-- 5) Public table insert/update/delete policies that uploads rely on.
select
  'public_policies' as check_name,
  schemaname,
  tablename,
  policyname,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'moments',
    'personal_photos',
    'feed_posts',
    'post_media',
    'trip_files',
    'feed_post_comments',
    'post_tags',
    'follows',
    'user_achievements'
  )
order by tablename, policyname, cmd;

-- 6) Storage policies for Moments and private Essentials files.
select
  'storage_policies' as check_name,
  schemaname,
  tablename,
  policyname,
  cmd
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and (
    policyname like 'trip_files_storage_%'
    or policyname like 'moments_storage_%'
    or policyname in (
      'authenticated can read public app media',
      'authenticated can upload app media',
      'owners can update app media',
      'owners can delete app media'
    )
  )
order by policyname, cmd;

-- 7) Required RPCs/functions. These are expected by current app builds.
select
  'required_functions' as check_name,
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args,
  case when p.prosecdef then 'security_definer' else 'security_invoker' end as security_mode
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'is_trip_owner',
    'is_trip_member',
    'is_trip_admin',
    'is_handle_available',
    'upsert_own_profile',
    'save_own_push_tokens',
    'update_own_onboarding_state',
    'replace_trip_flights_from_scan',
    'search_public_profiles',
    'get_public_profiles',
    'get_explore_feed'
  )
order by p.proname, args;

-- 8) Explore schema surface.
select
  'explore_tables' as check_name,
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'feed_posts',
    'post_media',
    'post_likes',
    'post_saves',
    'post_shares',
    'feed_post_comments',
    'post_tags',
    'stories',
    'story_views'
  )
order by table_name;

-- 9) @test1 candidates for targeted media/upload retesting.
select
  'test1_profiles' as check_name,
  id,
  email,
  handle,
  full_name,
  created_at
from public.profiles
where lower(handle) in ('test1', '@test1')
   or email ilike '%test1%'
order by created_at desc;
