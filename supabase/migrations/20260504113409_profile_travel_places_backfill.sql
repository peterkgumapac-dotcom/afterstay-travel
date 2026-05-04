-- Backfill the Travel Flex cache from existing trips/flights/moments.
-- This migration is intentionally conservative:
-- - completed, non-deleted, non-archived trips light up profile history
-- - shared trip members get the same completed trip place as companions
-- - outbound flight destinations add airport-accurate route points
-- - moments are cached only when they carry reliable coordinates

create table if not exists public.profile_airports (
  code text primary key,
  label text not null,
  country_code text not null,
  country_name text not null,
  lat double precision not null,
  lng double precision not null,
  updated_at timestamptz not null default now()
);

alter table public.profile_airports enable row level security;

drop policy if exists "profile_airports_authenticated_read" on public.profile_airports;
create policy "profile_airports_authenticated_read"
on public.profile_airports for select
to authenticated
using (true);

insert into public.profile_airports (code, label, country_code, country_name, lat, lng)
values
  ('MNL', 'Manila', 'PH', 'Philippines', 14.5086, 121.0194),
  ('MPH', 'Boracay', 'PH', 'Philippines', 11.9245, 121.9540),
  ('KLO', 'Kalibo', 'PH', 'Philippines', 11.6794, 122.3763),
  ('CEB', 'Cebu', 'PH', 'Philippines', 10.3075, 123.9794),
  ('DPS', 'Bali', 'ID', 'Indonesia', -8.7482, 115.1670),
  ('BKK', 'Bangkok', 'TH', 'Thailand', 13.6900, 100.7501),
  ('SIN', 'Singapore', 'SG', 'Singapore', 1.3644, 103.9915),
  ('HKG', 'Hong Kong', 'HK', 'Hong Kong', 22.3080, 113.9185),
  ('ICN', 'Seoul', 'KR', 'South Korea', 37.4602, 126.4407),
  ('NRT', 'Tokyo', 'JP', 'Japan', 35.7720, 140.3929),
  ('HND', 'Tokyo', 'JP', 'Japan', 35.5494, 139.7798),
  ('TYO', 'Tokyo', 'JP', 'Japan', 35.6762, 139.6503),
  ('DAD', 'Da Nang', 'VN', 'Vietnam', 16.0439, 108.1994)
on conflict (code) do update set
  label = excluded.label,
  country_code = excluded.country_code,
  country_name = excluded.country_name,
  lat = excluded.lat,
  lng = excluded.lng,
  updated_at = now();

create or replace function public.profile_extract_airport_code(p_text text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(upper(substring(coalesce(p_text, '') from '\(([A-Z]{3})\)\s*$')), '');
$$;

create or replace function public.profile_place_country_code(
  p_country_code text,
  p_country_name text,
  p_place text,
  p_airport_code text default null
)
returns text
language sql
stable
set search_path = public
as $$
  select coalesce(
    nullif(upper(p_country_code), ''),
    (select country_code from public.profile_airports where code = upper(nullif(p_airport_code, ''))),
    case
      when coalesce(p_country_name, p_place, '') ilike any(array['%philippines%', '%boracay%', '%caticlan%', '%manila%', '%cebu%', '%kalibo%']) then 'PH'
      when coalesce(p_country_name, p_place, '') ilike any(array['%thailand%', '%bangkok%']) then 'TH'
      when coalesce(p_country_name, p_place, '') ilike any(array['%vietnam%', '%da nang%', '%hoi an%']) then 'VN'
      when coalesce(p_country_name, p_place, '') ilike any(array['%indonesia%', '%bali%']) then 'ID'
      when coalesce(p_country_name, p_place, '') ilike '%singapore%' then 'SG'
      when coalesce(p_country_name, p_place, '') ilike any(array['%japan%', '%tokyo%']) then 'JP'
      when coalesce(p_country_name, p_place, '') ilike any(array['%south korea%', '%korea%', '%seoul%']) then 'KR'
      when coalesce(p_country_name, p_place, '') ilike '%hong kong%' then 'HK'
      else null
    end
  );
$$;

create or replace function public.profile_country_name_from_code(p_country_code text)
returns text
language sql
immutable
set search_path = public
as $$
  select case upper(coalesce(p_country_code, ''))
    when 'PH' then 'Philippines'
    when 'TH' then 'Thailand'
    when 'VN' then 'Vietnam'
    when 'ID' then 'Indonesia'
    when 'SG' then 'Singapore'
    when 'JP' then 'Japan'
    when 'KR' then 'South Korea'
    when 'HK' then 'Hong Kong'
    when 'US' then 'United States'
    when 'FR' then 'France'
    else null
  end;
$$;

create or replace function public.profile_place_clean_name(p_place text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(
    trim(
      regexp_replace(
        regexp_replace(coalesce(p_place, ''), '\s*\([A-Z]{3}\)\s*$', ''),
        '\s+',
        ' ',
        'g'
      )
    ),
    ''
  );
$$;

create or replace function public.profile_place_lat(p_place text, p_airport_code text default null)
returns double precision
language sql
stable
set search_path = public
as $$
  select coalesce(
    (select lat from public.profile_airports where code = upper(nullif(p_airport_code, ''))),
    case
      when coalesce(p_place, '') ilike any(array['%boracay%', '%caticlan%']) then 11.9674
      when coalesce(p_place, '') ilike '%manila%' then 14.5995
      when coalesce(p_place, '') ilike '%cebu%' then 10.3157
      when coalesce(p_place, '') ilike '%bangkok%' then 13.7563
      when coalesce(p_place, '') ilike '%da nang%' then 16.0544
      when coalesce(p_place, '') ilike '%hoi an%' then 15.8801
      when coalesce(p_place, '') ilike '%singapore%' then 1.3521
      when coalesce(p_place, '') ilike '%hong kong%' then 22.3193
      when coalesce(p_place, '') ilike '%seoul%' then 37.5665
      when coalesce(p_place, '') ilike '%tokyo%' then 35.6762
      when coalesce(p_place, '') ilike '%bali%' then -8.3405
      else null
    end
  );
$$;

create or replace function public.profile_place_lng(p_place text, p_airport_code text default null)
returns double precision
language sql
stable
set search_path = public
as $$
  select coalesce(
    (select lng from public.profile_airports where code = upper(nullif(p_airport_code, ''))),
    case
      when coalesce(p_place, '') ilike any(array['%boracay%', '%caticlan%']) then 121.9248
      when coalesce(p_place, '') ilike '%manila%' then 120.9842
      when coalesce(p_place, '') ilike '%cebu%' then 123.8854
      when coalesce(p_place, '') ilike '%bangkok%' then 100.5018
      when coalesce(p_place, '') ilike '%da nang%' then 108.2022
      when coalesce(p_place, '') ilike '%hoi an%' then 108.3380
      when coalesce(p_place, '') ilike '%singapore%' then 103.8198
      when coalesce(p_place, '') ilike '%hong kong%' then 114.1694
      when coalesce(p_place, '') ilike '%seoul%' then 126.9780
      when coalesce(p_place, '') ilike '%tokyo%' then 139.6503
      when coalesce(p_place, '') ilike '%bali%' then 115.0920
      else null
    end
  );
$$;

create or replace function public.profile_trip_is_visual_eligible(
  p_status text,
  p_end_date date,
  p_is_draft boolean,
  p_deleted_at timestamptz,
  p_archived_at timestamptz
)
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(p_is_draft, false) = false
    and p_deleted_at is null
    and p_archived_at is null
    and (
      lower(coalesce(p_status, '')) = 'completed'
      or (p_end_date is not null and p_end_date <= current_date)
    );
$$;

-- Keep counts honest: trips/flights may produce multiple rows for the same
-- location, so the RPC counts distinct place/country keys instead of raw rows.
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
visible_places_raw as (
  select
    ptp.*,
    lower(trim(coalesce(ptp.place_name, ''))) || '|' || coalesce(nullif(upper(ptp.country_code), ''), coalesce(ptp.country_name, '')) as place_key
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
visible_places as (
  select distinct on (place_key)
    *
  from visible_places_raw
  order by place_key, case confidence
    when 'exact_flight' then 1
    when 'exact_place' then 2
    when 'country_estimate' then 3
    when 'text_guess' then 4
    else 5
  end, occurred_on desc nulls last, created_at desc
),
country_rollup as (
  select
    coalesce(nullif(upper(country_code), ''), 'XX') as country_code,
    coalesce(nullif(country_name, ''), 'Unknown') as country_name,
    count(distinct place_key)::int as place_count,
    min(occurred_on) as first_seen
  from visible_places
  group by 1, 2
),
counts as (
  select
    count(distinct trip_id)::int as trip_count,
    count(distinct coalesce(nullif(upper(country_code), ''), country_name))::int as country_count,
    count(distinct place_key)::int as place_count,
    count(photo_url)::int as photo_count
  from visible_places_raw
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
      from visible_places_raw
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
      row_number() over (order by case confidence when 'exact_flight' then 1 when 'exact_place' then 2 else 3 end, occurred_on desc nulls last, created_at desc) as rn
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

with trip_participants as (
  select t.id as trip_id, t.user_id
  from public.trips t
  where t.user_id is not null
  union
  select gm.trip_id, gm.user_id
  from public.group_members gm
  where gm.user_id is not null
),
eligible_trips as (
  select
    t.*,
    tp.user_id as profile_user_id,
    public.profile_extract_airport_code(t.destination) as airport_code
  from public.trips t
  join trip_participants tp on tp.trip_id = t.id
  join public.profiles p on p.id = tp.user_id
  where public.profile_trip_is_visual_eligible(t.status, t.end_date, t.is_draft, t.deleted_at, t.archived_at)
),
prepared_trips as (
  select
    profile_user_id,
    id as trip_id,
    'trip'::text as source_type,
    id::text as source_id,
    coalesce(public.profile_place_clean_name(destination), name, 'Trip stop') as place_name,
    public.profile_place_country_code(country_code, country, destination, airport_code) as country_code,
    airport_code,
    latitude::double precision as trip_lat,
    longitude::double precision as trip_lng,
    start_date,
    cover_image,
    exists (
      select 1
      from public.group_members gm1
      join public.group_members gm2 on gm2.trip_id = gm1.trip_id
      where gm1.trip_id = eligible_trips.id
        and gm1.user_id = eligible_trips.profile_user_id
        and gm2.user_id is not null
        and gm2.user_id <> eligible_trips.profile_user_id
    ) as has_companions
  from eligible_trips
)
insert into public.profile_travel_places (
  user_id,
  trip_id,
  source_type,
  source_id,
  place_name,
  country_code,
  country_name,
  airport_code,
  lat,
  lng,
  occurred_on,
  photo_url,
  visibility,
  confidence
)
select
  profile_user_id,
  trip_id,
  source_type,
  source_id,
  place_name,
  country_code,
  coalesce(public.profile_country_name_from_code(country_code), country_code),
  airport_code,
  coalesce(trip_lat, public.profile_place_lat(place_name, airport_code)),
  coalesce(trip_lng, public.profile_place_lng(place_name, airport_code)),
  start_date,
  cover_image,
  case when has_companions then 'companions' else 'private' end,
  case when trip_lat is not null and trip_lng is not null then 'exact_place' else 'country_estimate' end
from prepared_trips
where country_code is not null
on conflict (user_id, source_type, source_id) where source_id is not null
do update set
  trip_id = excluded.trip_id,
  place_name = excluded.place_name,
  country_code = excluded.country_code,
  country_name = excluded.country_name,
  airport_code = excluded.airport_code,
  lat = excluded.lat,
  lng = excluded.lng,
  occurred_on = excluded.occurred_on,
  photo_url = excluded.photo_url,
  visibility = excluded.visibility,
  confidence = excluded.confidence,
  updated_at = now();

with trip_participants as (
  select t.id as trip_id, t.user_id
  from public.trips t
  where t.user_id is not null
  union
  select gm.trip_id, gm.user_id
  from public.group_members gm
  where gm.user_id is not null
),
eligible_flights as (
  select
    f.*,
    t.status,
    t.end_date,
    t.is_draft,
    t.deleted_at,
    t.archived_at,
    tp.user_id as profile_user_id,
    public.profile_extract_airport_code(f.destination) as airport_code
  from public.flights f
  join public.trips t on t.id = f.trip_id
  join trip_participants tp on tp.trip_id = t.id
  join public.profiles p on p.id = tp.user_id
  where public.profile_trip_is_visual_eligible(t.status, t.end_date, t.is_draft, t.deleted_at, t.archived_at)
    and f.destination is not null
    and coalesce(lower(f.direction), '') <> 'return'
),
prepared_flights as (
  select
    profile_user_id,
    trip_id,
    'flight'::text as source_type,
    id::text as source_id,
    coalesce((select label from public.profile_airports where code = airport_code), public.profile_place_clean_name(destination), 'Flight stop') as place_name,
    public.profile_place_country_code(null, null, destination, airport_code) as country_code,
    airport_code,
    arrival_time::date as occurred_on,
    exists (
      select 1
      from public.group_members gm1
      join public.group_members gm2 on gm2.trip_id = gm1.trip_id
      where gm1.trip_id = eligible_flights.trip_id
        and gm1.user_id = eligible_flights.profile_user_id
        and gm2.user_id is not null
        and gm2.user_id <> eligible_flights.profile_user_id
    ) as has_companions
  from eligible_flights
  where airport_code is not null
)
insert into public.profile_travel_places (
  user_id,
  trip_id,
  source_type,
  source_id,
  place_name,
  country_code,
  country_name,
  airport_code,
  lat,
  lng,
  occurred_on,
  visibility,
  confidence
)
select
  profile_user_id,
  trip_id,
  source_type,
  source_id,
  place_name,
  country_code,
  coalesce(public.profile_country_name_from_code(country_code), country_code),
  airport_code,
  public.profile_place_lat(place_name, airport_code),
  public.profile_place_lng(place_name, airport_code),
  occurred_on,
  case when has_companions then 'companions' else 'private' end,
  'exact_flight'
from prepared_flights
where country_code is not null
on conflict (user_id, source_type, source_id) where source_id is not null
do update set
  trip_id = excluded.trip_id,
  place_name = excluded.place_name,
  country_code = excluded.country_code,
  country_name = excluded.country_name,
  airport_code = excluded.airport_code,
  lat = excluded.lat,
  lng = excluded.lng,
  occurred_on = excluded.occurred_on,
  visibility = excluded.visibility,
  confidence = excluded.confidence,
  updated_at = now();

insert into public.profile_travel_places (
  user_id,
  trip_id,
  source_type,
  source_id,
  place_name,
  country_code,
  country_name,
  lat,
  lng,
  occurred_on,
  photo_url,
  visibility,
  confidence
)
select
  m.user_id,
  m.trip_id,
  'moment',
  m.id::text,
  coalesce(public.profile_place_clean_name(m.location), public.profile_place_clean_name(t.destination), 'Moment stop'),
  public.profile_place_country_code(t.country_code, t.country, coalesce(m.location, t.destination), null),
  coalesce(
    public.profile_country_name_from_code(public.profile_place_country_code(t.country_code, t.country, coalesce(m.location, t.destination), null)),
    t.country
  ),
  m.latitude::double precision,
  m.longitude::double precision,
  m.taken_at::date,
  coalesce(m.public_url, m.hd_url),
  case when coalesce(m.is_public, false) then 'public' when m.visibility = 'shared' then 'companions' else 'private' end,
  'exact_place'
from public.moments m
left join public.trips t on t.id = m.trip_id
join public.profiles p on p.id = m.user_id
where m.user_id is not null
  and m.latitude is not null
  and m.longitude is not null
  and public.profile_place_country_code(t.country_code, t.country, coalesce(m.location, t.destination), null) is not null
on conflict (user_id, source_type, source_id) where source_id is not null
do update set
  trip_id = excluded.trip_id,
  place_name = excluded.place_name,
  country_code = excluded.country_code,
  country_name = excluded.country_name,
  lat = excluded.lat,
  lng = excluded.lng,
  occurred_on = excluded.occurred_on,
  photo_url = excluded.photo_url,
  visibility = excluded.visibility,
  confidence = excluded.confidence,
  updated_at = now();
