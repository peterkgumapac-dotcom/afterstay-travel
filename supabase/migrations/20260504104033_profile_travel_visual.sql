-- Travel Flex profile visual model.
-- Normalizes profile-safe travel stops into one backend contract without
-- exposing booking refs, passengers, files, or private expenses.

create table if not exists public.profile_travel_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete cascade,
  source_type text not null check (source_type in ('flight','trip','moment','itinerary','hotel','manual')),
  source_id text,
  place_name text not null,
  country_code text,
  country_name text,
  airport_code text,
  lat double precision,
  lng double precision,
  occurred_on date,
  photo_url text,
  visibility text not null default 'private' check (visibility in ('private','companions','public')),
  confidence text not null default 'text_guess' check (confidence in ('exact_flight','exact_place','country_estimate','text_guess','unknown')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profile_travel_places_user_idx
  on public.profile_travel_places(user_id, occurred_on desc);

create index if not exists profile_travel_places_trip_idx
  on public.profile_travel_places(trip_id)
  where trip_id is not null;

create unique index if not exists profile_travel_places_source_unique
  on public.profile_travel_places(user_id, source_type, source_id)
  where source_id is not null;

alter table public.profile_travel_places enable row level security;

drop policy if exists "profile_travel_places_owner_read" on public.profile_travel_places;
create policy "profile_travel_places_owner_read"
on public.profile_travel_places for select
using (auth.uid() = user_id);

drop policy if exists "profile_travel_places_public_read" on public.profile_travel_places;
create policy "profile_travel_places_public_read"
on public.profile_travel_places for select
using (visibility = 'public');

drop policy if exists "profile_travel_places_companion_read" on public.profile_travel_places;
create policy "profile_travel_places_companion_read"
on public.profile_travel_places for select
using (
  visibility in ('companions', 'public')
  and trip_id is not null
  and exists (
    select 1
    from public.group_members viewer_member
    join public.group_members owner_member
      on owner_member.trip_id = viewer_member.trip_id
    where viewer_member.user_id = auth.uid()
      and owner_member.user_id = profile_travel_places.user_id
      and viewer_member.trip_id = profile_travel_places.trip_id
  )
);

drop policy if exists "profile_travel_places_owner_write" on public.profile_travel_places;
create policy "profile_travel_places_owner_write"
on public.profile_travel_places for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.set_profile_travel_places_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profile_travel_places_updated_at on public.profile_travel_places;
create trigger set_profile_travel_places_updated_at
before update on public.profile_travel_places
for each row execute function public.set_profile_travel_places_updated_at();

create or replace function public.profile_visual_flag(p_country_code text)
returns text
language sql
immutable
set search_path = public
as $$
  select case upper(coalesce(p_country_code, ''))
    when 'PH' then '🇵🇭'
    when 'TH' then '🇹🇭'
    when 'VN' then '🇻🇳'
    when 'ID' then '🇮🇩'
    when 'SG' then '🇸🇬'
    when 'JP' then '🇯🇵'
    when 'KR' then '🇰🇷'
    when 'HK' then '🇭🇰'
    when 'US' then '🇺🇸'
    else '🌍'
  end;
$$;

create or replace function public.get_profile_travel_visual(p_user_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
with viewer as (
  select auth.uid() as id
),
relationship as (
  select
    v.id = p_user_id as is_self,
    exists (
      select 1
      from public.group_members mine
      join public.group_members theirs
        on theirs.trip_id = mine.trip_id
      where mine.user_id = v.id
        and theirs.user_id = p_user_id
    ) as is_companion
  from viewer v
),
profile_row as (
  select p.*
  from public.profiles p, relationship r
  where p.id = p_user_id
    and (
      r.is_self
      or r.is_companion
      or coalesce(p.profile_visibility, 'public') = 'public'
    )
),
visible_places as (
  select ptp.*
  from public.profile_travel_places ptp
  join profile_row pr on pr.id = ptp.user_id
  cross join relationship r
  where ptp.user_id = p_user_id
    and (
      r.is_self
      or ptp.visibility = 'public'
      or (
        r.is_companion
        and ptp.visibility in ('companions', 'public')
        and ptp.trip_id is not null
        and exists (
          select 1
          from public.group_members mine
          join public.group_members theirs
            on theirs.trip_id = mine.trip_id
          where mine.user_id = (select id from viewer)
            and theirs.user_id = p_user_id
            and mine.trip_id = ptp.trip_id
        )
      )
    )
),
country_rollup as (
  select
    coalesce(nullif(upper(country_code), ''), 'XX') as country_code,
    coalesce(nullif(country_name, ''), 'Unknown') as country_name,
    count(*)::int as place_count,
    min(occurred_on) as first_seen
  from visible_places
  group by 1, 2
),
counts as (
  select
    count(distinct trip_id)::int as trip_count,
    count(distinct coalesce(nullif(upper(country_code), ''), country_name))::int as country_count,
    count(*)::int as place_count,
    count(photo_url)::int as photo_count,
    coalesce(max(confidence), 'unknown') as raw_confidence
  from visible_places
),
stats as (
  select
    coalesce(ls.total_trips, 0)::int as total_trips,
    coalesce(ls.total_countries, 0)::int as total_countries,
    coalesce(ls.total_nights, 0)::int as total_nights,
    coalesce(ls.total_miles, 0)::numeric as total_miles,
    coalesce(ls.total_spent, 0)::numeric as total_spent,
    coalesce(ls.total_moments, 0)::int as total_moments
  from profile_row pr
  left join public.lifetime_stats ls on ls.user_id = pr.id
),
safe_counts as (
  select
    case when c.trip_count > 0 then c.trip_count else case when r.is_self or r.is_companion or coalesce(pr.public_stats_enabled, false) then s.total_trips else 0 end end as trips,
    case when c.country_count > 0 then c.country_count else case when r.is_self or r.is_companion or coalesce(pr.public_stats_enabled, false) then s.total_countries else 0 end end as countries,
    c.place_count as places,
    case when r.is_self or r.is_companion or coalesce(pr.public_stats_enabled, false) then s.total_nights else 0 end as nights,
    greatest(c.photo_count, case when r.is_self or r.is_companion or coalesce(pr.public_stats_enabled, false) then s.total_moments else 0 end) as photos,
    case when r.is_self or r.is_companion or coalesce(pr.public_stats_enabled, false) then s.total_spent else 0 end as spent,
    round(case when r.is_self or r.is_companion or coalesce(pr.public_stats_enabled, false) then s.total_miles * 1.60934 else 0 end)::int as km
  from counts c, stats s, profile_row pr, relationship r
),
template as (
  select
    case
      when trips = 0 and countries = 0 and places = 0 then 'empty'
      when countries <= 1 and places <= 1 and trips <= 1 then 'first_place'
      when countries <= 1 then 'local_explorer'
      when countries = 2 then 'first_abroad'
      when countries <= 8 then 'regional_traveler'
      else 'global_flex'
    end as template
  from safe_counts
),
animation as (
  select
    case template
      when 'empty' then 'none'
      when 'first_place' then 'single_arc'
      when 'local_explorer' then 'local_hops'
      when 'first_abroad' then 'country_hops'
      when 'regional_traveler' then 'country_hops'
      else 'route_constellation'
    end as animation_mode
  from template
),
confidence as (
  select coalesce(
    (
      select confidence
      from visible_places
      order by case confidence
        when 'exact_flight' then 1
        when 'exact_place' then 2
        when 'country_estimate' then 3
        when 'text_guess' then 4
        else 5
      end
      limit 1
    ),
    case when (select countries from safe_counts) > 0 then 'country_estimate' else 'unknown' end
  ) as confidence
),
flags as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'countryCode', country_code,
    'countryName', country_name,
    'flag', public.profile_visual_flag(country_code),
    'visitedPlaces', place_count
  ) order by place_count desc, first_seen nulls last), '[]'::jsonb) as flags
  from country_rollup
),
places as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'label', place_name,
    'countryCode', nullif(upper(country_code), ''),
    'countryName', country_name,
    'flag', public.profile_visual_flag(country_code),
    'lat', lat,
    'lng', lng,
    'source', source_type,
    'confidence', confidence
  ) order by occurred_on nulls last, created_at desc), '[]'::jsonb) as places
  from (
    select *
    from visible_places
    order by occurred_on nulls last, created_at desc
    limit 12
  ) p
),
routes as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', concat('place-', id::text),
    'fromLabel', 'HOME',
    'toLabel', place_name,
    'toCode', nullif(upper(coalesce(airport_code, country_code)), ''),
    'toLat', lat,
    'toLng', lng,
    'tripId', trip_id,
    'confidence', confidence,
    'featured', rn = 1
  ) order by rn), '[]'::jsonb) as routes
  from (
    select
      vp.*,
      row_number() over (order by occurred_on desc nulls last, created_at desc) as rn
    from visible_places vp
    where lat is not null and lng is not null
    limit 8
  ) r
),
home as (
  select jsonb_build_object(
    'code', 'MNL',
    'label', coalesce(nullif(pr.home_base, ''), 'HOME'),
    'lat', 14.5086,
    'lng', 121.0194,
    'flag', '🇵🇭'
  ) as home
  from profile_row pr
)
select case
  when not exists (select 1 from profile_row) then null
  else jsonb_build_object(
    'counts', jsonb_build_object(
      'trips', sc.trips,
      'countries', sc.countries,
      'places', sc.places,
      'nights', sc.nights,
      'photos', sc.photos,
      'spent', sc.spent,
      'km', sc.km
    ),
    'flags', f.flags,
    'places', p.places,
    'routes', r.routes,
    'template', t.template,
    'animationMode', a.animation_mode,
    'confidence', c.confidence,
    'home', h.home,
    'since', 'now'
  )
end
from safe_counts sc
cross join flags f
cross join places p
cross join routes r
cross join template t
cross join animation a
cross join confidence c
cross join home h;
$$;

revoke execute on function public.get_profile_travel_visual(uuid) from anon;
revoke execute on function public.get_profile_travel_visual(uuid) from public;
grant execute on function public.get_profile_travel_visual(uuid) to authenticated;
