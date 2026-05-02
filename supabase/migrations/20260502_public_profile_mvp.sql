-- Public profile MVP
-- - Profile customization fields
-- - Follows and lightweight achievements
-- - Public-safe profile RPCs

alter table if exists public.profiles
  add column if not exists bio text,
  add column if not exists home_base text,
  add column if not exists profile_visibility text default 'public'
    check (profile_visibility in ('public', 'companions', 'private')),
  add column if not exists public_stats_enabled boolean default false,
  add column if not exists profile_badges jsonb default '[]'::jsonb;

create table if not exists public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

alter table public.follows enable row level security;

drop policy if exists "follows_select_public" on public.follows;
create policy "follows_select_public"
on public.follows for select
using (auth.uid() is not null);

drop policy if exists "follows_insert_own" on public.follows;
create policy "follows_insert_own"
on public.follows for insert
with check (follower_id = auth.uid());

drop policy if exists "follows_delete_own" on public.follows;
create policy "follows_delete_own"
on public.follows for delete
using (follower_id = auth.uid());

create table if not exists public.achievements (
  key text primary key,
  title text not null,
  description text,
  icon text,
  criteria jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.user_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_key text not null references public.achievements(key) on delete cascade,
  unlocked_at timestamptz default now(),
  progress jsonb default '{}'::jsonb,
  primary key (user_id, achievement_key)
);

alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;

drop policy if exists "achievements_read" on public.achievements;
create policy "achievements_read"
on public.achievements for select
using (auth.uid() is not null);

drop policy if exists "user_achievements_read_public" on public.user_achievements;
create policy "user_achievements_read_public"
on public.user_achievements for select
using (auth.uid() is not null);

drop policy if exists "user_achievements_manage_own" on public.user_achievements;
create policy "user_achievements_manage_own"
on public.user_achievements for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

insert into public.achievements (key, title, description, icon, criteria)
values
  ('explorer', 'Explorer', 'Visited your first country', 'compass', '{"minCountries":1}'::jsonb),
  ('globetrotter', 'Globetrotter', 'Built a meaningful trip history', 'plane', '{"minTrips":5}'::jsonb),
  ('memory_maker', 'Memory Maker', 'Shared travel photos', 'camera', '{"minMoments":1}'::jsonb)
on conflict (key) do update set
  title = excluded.title,
  description = excluded.description,
  icon = excluded.icon,
  criteria = excluded.criteria;

create or replace function public.get_public_profile_posts(
  p_user_id uuid,
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  id uuid,
  user_id uuid,
  type text,
  caption text,
  photo_url text,
  location_name text,
  latitude numeric,
  longitude numeric,
  layout_type text,
  metadata jsonb,
  created_at timestamptz,
  likes_count int,
  comments_count int,
  share_count int,
  save_count int,
  media jsonb
)
language sql
security definer
set search_path = public
as $$
  select
    fp.id,
    fp.user_id,
    fp.type,
    fp.caption,
    fp.photo_url,
    fp.location_name,
    fp.latitude,
    fp.longitude,
    fp.layout_type,
    '{}'::jsonb as metadata,
    fp.created_at,
    fp.likes_count,
    fp.comments_count,
    fp.share_count,
    fp.save_count,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pm.id,
        'mediaUrl', pm.media_url,
        'storagePath', pm.storage_path,
        'mediaType', pm.media_type,
        'orderIndex', pm.order_index
      ) order by pm.order_index)
      from public.post_media pm
      where pm.post_id = fp.id
    ), '[]'::jsonb) as media
  from public.feed_posts fp
  where fp.user_id = p_user_id
    and fp.is_public = true
  order by fp.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function public.get_public_profile_posts(uuid, int, int) to authenticated;

create or replace function public.get_public_profile(
  p_user_id uuid
)
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

grant execute on function public.get_public_profile(uuid) to authenticated;

drop policy if exists "users create own" on public.feed_posts;
create policy "users create own"
on public.feed_posts for insert
with check (
  user_id = auth.uid()
  and (
    trip_id is null
    or public.is_trip_owner(trip_id, auth.uid())
    or public.is_trip_member(trip_id, auth.uid())
  )
  and (
    moment_id is null
    or exists (
      select 1 from public.moments m
      where m.id = moment_id
        and m.user_id = auth.uid()
    )
  )
);

drop policy if exists "users update own" on public.feed_posts;
create policy "users update own"
on public.feed_posts for update
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and (
    trip_id is null
    or public.is_trip_owner(trip_id, auth.uid())
    or public.is_trip_member(trip_id, auth.uid())
  )
  and (
    moment_id is null
    or exists (
      select 1 from public.moments m
      where m.id = moment_id
        and m.user_id = auth.uid()
    )
  )
);
