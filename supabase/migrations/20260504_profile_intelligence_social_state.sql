-- Profile intelligence social state
-- Adds public-safe relationship and lightweight travel facts to get_public_profile.

alter table if exists public.lifetime_stats
  add column if not exists total_moments int default 0,
  add column if not exists countries_list text[] default '{}'::text[];

create unique index if not exists profiles_handle_unique
  on public.profiles (lower(handle))
  where handle is not null;

alter table public.profiles
  drop constraint if exists handle_format;

alter table public.profiles
  add constraint handle_format
  check (handle is null or handle ~ '^[a-z][a-z0-9_]{2,19}$');

create or replace function public.is_handle_available(
  p_handle text,
  p_current_user_id uuid default null
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select trim(coalesce(p_handle, '')) ~* '^[a-z][a-z0-9_]{2,19}$'
    and not exists (
      select 1
      from public.profiles
      where lower(handle) = lower(trim(p_handle))
        and (p_current_user_id is null or id <> p_current_user_id)
    );
$$;

create or replace function public.upsert_own_profile(
  p_full_name text default null,
  p_handle text default null,
  p_avatar_url text default null,
  p_phone text default null,
  p_socials jsonb default null,
  p_cover_photo_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    full_name,
    handle,
    avatar_url,
    phone,
    socials,
    cover_photo_url
  )
  values (
    auth.uid(),
    nullif(p_full_name, ''),
    nullif(trim(lower(p_handle)), ''),
    nullif(p_avatar_url, ''),
    nullif(p_phone, ''),
    coalesce(p_socials, '{}'::jsonb),
    nullif(p_cover_photo_url, '')
  )
  on conflict (id) do update set
    full_name = coalesce(nullif(p_full_name, ''), public.profiles.full_name),
    handle = case when p_handle is null then public.profiles.handle else nullif(trim(lower(p_handle)), '') end,
    avatar_url = case when p_avatar_url is null then public.profiles.avatar_url else nullif(p_avatar_url, '') end,
    phone = case when p_phone is null then public.profiles.phone else nullif(p_phone, '') end,
    socials = case when p_socials is null then public.profiles.socials else p_socials end,
    cover_photo_url = case when p_cover_photo_url is null then public.profiles.cover_photo_url else nullif(p_cover_photo_url, '') end;
end;
$$;

revoke execute on function public.is_handle_available(text, uuid) from anon;
revoke execute on function public.is_handle_available(text, uuid) from public;
grant execute on function public.is_handle_available(text, uuid) to authenticated;

revoke execute on function public.upsert_own_profile(text, text, text, text, jsonb, text) from anon;
revoke execute on function public.upsert_own_profile(text, text, text, text, jsonb, text) from public;
grant execute on function public.upsert_own_profile(text, text, text, text, jsonb, text) to authenticated;

create or replace function public.get_public_profile(p_user_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  with viewer as (
    select auth.uid() as id
  ),
  profile_row as (
    select p.*
    from public.profiles p
    where p.id = p_user_id
      and coalesce(p.profile_visibility, 'public') = 'public'
  ),
  relationship as (
    select
      (v.id = p_user_id) as is_self,
      exists (
        select 1
        from public.group_members mine
        join public.group_members theirs
          on theirs.trip_id = mine.trip_id
        where mine.user_id = v.id
          and theirs.user_id = p_user_id
          and v.id is not null
          and v.id <> p_user_id
      ) as is_companion,
      exists (
        select 1
        from public.follows f
        where f.follower_id = v.id
          and f.following_id = p_user_id
      ) as viewer_follows_user,
      exists (
        select 1
        from public.follows f
        where f.follower_id = p_user_id
          and f.following_id = v.id
      ) as user_follows_viewer
    from viewer v
  ),
  stats as (
    select ls.*
    from public.lifetime_stats ls
    where ls.user_id = p_user_id
  )
  select jsonb_build_object(
    'id', p.id,
    'fullName', coalesce(p.full_name, 'Traveler'),
    'handle', p.handle,
    'avatarUrl', p.avatar_url,
    'coverPhotoUrl', p.cover_photo_url,
    'bio', p.bio,
    'homeBase', p.home_base,
    'profileVisibility', coalesce(p.profile_visibility, 'public'),
    'publicStatsEnabled', coalesce(p.public_stats_enabled, false),
    'profileBadges', coalesce(p.profile_badges, '[]'::jsonb),
    'followersCount', (select count(*) from public.follows f where f.following_id = p.id),
    'followingCount', (select count(*) from public.follows f where f.follower_id = p.id),
    'viewerIsFollowing', r.viewer_follows_user,
    'viewerIsFollowedBy', r.user_follows_viewer,
    'viewerIsMutualFollow', (r.viewer_follows_user and r.user_follows_viewer),
    'relationship', jsonb_build_object(
      'isSelf', r.is_self,
      'isCompanion', r.is_companion,
      'viewerFollowsUser', r.viewer_follows_user,
      'userFollowsViewer', r.user_follows_viewer,
      'isMutualFollow', (r.viewer_follows_user and r.user_follows_viewer),
      'canMessage', ((not r.is_self) and (r.is_companion or (r.viewer_follows_user and r.user_follows_viewer)))
    ),
    'profileTravelFacts', jsonb_build_object(
      'tripCount', case when coalesce(p.public_stats_enabled, false) then coalesce(s.total_trips, 0) else 0 end,
      'countryCount', case when coalesce(p.public_stats_enabled, false) then coalesce(s.total_countries, 0) else 0 end,
      'nightCount', case when coalesce(p.public_stats_enabled, false) then coalesce(s.total_nights, 0) else 0 end,
      'spentTotal', case when coalesce(p.public_stats_enabled, false) then coalesce(s.total_spent, 0) else 0 end,
      'photoCount', case when coalesce(p.public_stats_enabled, false) then coalesce(s.total_moments, 0) else 0 end,
      'countries', '[]'::jsonb,
      'places', '[]'::jsonb,
      'routes', '[]'::jsonb,
      'mapTemplate', case
        when not coalesce(p.public_stats_enabled, false) or coalesce(s.total_trips, 0) = 0 then 'empty'
        when coalesce(s.total_countries, 0) <= 1 and coalesce(s.total_trips, 0) < 4 then 'local-starter'
        when coalesce(s.total_countries, 0) <= 1 then 'local-explorer'
        when coalesce(s.total_countries, 0) = 2 then 'abroad-starter'
        when coalesce(s.total_countries, 0) <= 8 then 'regional-flex'
        else 'global-passport'
      end,
      'confidence', case when coalesce(p.public_stats_enabled, false) then 'country_estimate' else 'unknown' end
    )
  )
  from profile_row p
  cross join relationship r
  left join stats s on true;
$$;

revoke execute on function public.get_public_profile(uuid) from anon;
revoke execute on function public.get_public_profile(uuid) from public;
grant execute on function public.get_public_profile(uuid) to authenticated;
