alter table public.profiles
  add column if not exists cover_photo_url text;

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
    nullif(p_handle, ''),
    nullif(p_avatar_url, ''),
    nullif(p_phone, ''),
    coalesce(p_socials, '{}'::jsonb),
    nullif(p_cover_photo_url, '')
  )
  on conflict (id) do update set
    full_name = coalesce(nullif(p_full_name, ''), public.profiles.full_name),
    handle = case when p_handle is null then public.profiles.handle else nullif(p_handle, '') end,
    avatar_url = case when p_avatar_url is null then public.profiles.avatar_url else nullif(p_avatar_url, '') end,
    phone = case when p_phone is null then public.profiles.phone else nullif(p_phone, '') end,
    socials = case when p_socials is null then public.profiles.socials else p_socials end,
    cover_photo_url = case when p_cover_photo_url is null then public.profiles.cover_photo_url else nullif(p_cover_photo_url, '') end;
end;
$$;

revoke execute on function public.upsert_own_profile(text, text, text, text, jsonb, text) from anon;
revoke execute on function public.upsert_own_profile(text, text, text, text, jsonb, text) from public;
grant execute on function public.upsert_own_profile(text, text, text, text, jsonb, text) to authenticated;

create or replace function public.get_public_profile(p_user_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
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
    'viewerIsFollowing', exists (
      select 1 from public.follows f
      where f.follower_id = auth.uid()
        and f.following_id = p.id
    )
  )
  from public.profiles p
  where p.id = p_user_id
    and coalesce(p.profile_visibility, 'public') = 'public';
$$;

revoke execute on function public.get_public_profile(uuid) from anon;
revoke execute on function public.get_public_profile(uuid) from public;
grant execute on function public.get_public_profile(uuid) to authenticated;
