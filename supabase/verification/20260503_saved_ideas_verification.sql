select
  'wishlist source columns' as check_name,
  count(*) filter (
    where column_name in ('source_post_id', 'source_trip_id')
  ) = 2 as ok,
  jsonb_agg(column_name order by column_name) filter (
    where column_name in ('source_post_id', 'source_trip_id')
  ) as details
from information_schema.columns
where table_schema = 'public'
  and table_name = 'wishlist'

union all

select
  'wishlist place metadata columns' as check_name,
  count(*) filter (
    where column_name in (
      'name',
      'category',
      'google_place_id',
      'photo_url',
      'rating',
      'total_ratings',
      'latitude',
      'longitude',
      'address',
      'destination',
      'notes',
      'created_at'
    )
  ) = 12 as ok,
  jsonb_agg(column_name order by column_name) filter (
    where column_name in (
      'name',
      'category',
      'google_place_id',
      'photo_url',
      'rating',
      'total_ratings',
      'latitude',
      'longitude',
      'address',
      'destination',
      'notes',
      'created_at'
    )
  ) as details
from information_schema.columns
where table_schema = 'public'
  and table_name = 'wishlist'

union all

select
  'wishlist google place dedupe index' as check_name,
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'wishlist'
      and indexname = 'wishlist_user_google_place_unique_idx'
  ) as ok,
  coalesce(
    (
      select to_jsonb(indexdef)
      from pg_indexes
      where schemaname = 'public'
        and tablename = 'wishlist'
        and indexname = 'wishlist_user_google_place_unique_idx'
    ),
    'null'::jsonb
  ) as details

union all

select
  'wishlist owner rls policy' as check_name,
  (
    select relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'wishlist'
  )
  and exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'wishlist'
      and cmd = 'SELECT'
      and qual = '(auth.uid() = user_id)'
  )
  and exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'wishlist'
      and cmd = 'INSERT'
      and with_check = '(auth.uid() = user_id)'
  )
  and exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'wishlist'
      and cmd = 'UPDATE'
      and qual = '(auth.uid() = user_id)'
  )
  and exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'wishlist'
      and cmd = 'DELETE'
      and qual = '(auth.uid() = user_id)'
  ) as ok,
  coalesce(
    (
      select jsonb_agg(jsonb_build_object('name', policyname, 'cmd', cmd, 'using', qual, 'check', with_check) order by cmd)
      from pg_policies
      where schemaname = 'public'
        and tablename = 'wishlist'
    ),
    'null'::jsonb
  ) as details

union all

select
  'saved ideas migrations registered' as check_name,
  count(*) filter (
    where version in ('20260503041000', '20260503042500')
  ) = 2 as ok,
  jsonb_agg(version order by version) filter (
    where version in ('20260503041000', '20260503042500')
  ) as details
from supabase_migrations.schema_migrations;
