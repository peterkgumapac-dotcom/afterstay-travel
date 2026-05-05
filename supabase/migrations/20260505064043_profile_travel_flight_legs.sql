-- Make profile Travel Flex distance dynamic from real flight legs.
-- Before this migration, flight rows were cached as one destination point, so
-- profile KM had to estimate HOME -> place and double completed trips. This
-- stores origin and destination coordinates per flight and makes exact legs win.

alter table public.profile_travel_places
  add column if not exists from_airport_code text,
  add column if not exists from_place_name text,
  add column if not exists from_lat double precision,
  add column if not exists from_lng double precision,
  add column if not exists to_airport_code text,
  add column if not exists to_place_name text,
  add column if not exists to_lat double precision,
  add column if not exists to_lng double precision,
  add column if not exists flight_direction text;

create or replace function public.profile_extract_airport_code(p_text text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(
    upper(
      coalesce(
        substring(trim(coalesce(p_text, '')) from '\(([A-Z]{3})\)\s*$'),
        case
          when trim(coalesce(p_text, '')) ~* '^[A-Z]{3}$' then trim(coalesce(p_text, ''))
          else null
        end
      )
    ),
    ''
  );
$$;

create or replace function public.refresh_profile_travel_places_for_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    return;
  end if;

  delete from public.profile_travel_places
  where user_id = p_user_id
    and source_type in ('trip', 'flight', 'moment');

  with trip_participants as (
    select t.id as trip_id, t.user_id
    from public.trips t
    where t.user_id = p_user_id
    union
    select gm.trip_id, gm.user_id
    from public.group_members gm
    where gm.user_id = p_user_id
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
    from_airport_code = null,
    from_place_name = null,
    from_lat = null,
    from_lng = null,
    to_airport_code = null,
    to_place_name = null,
    to_lat = null,
    to_lng = null,
    flight_direction = null,
    updated_at = now();

  with trip_participants as (
    select t.id as trip_id, t.user_id
    from public.trips t
    where t.user_id = p_user_id
    union
    select gm.trip_id, gm.user_id
    from public.group_members gm
    where gm.user_id = p_user_id
  ),
  eligible_flights as (
    select
      f.*,
      tp.user_id as profile_user_id,
      public.profile_extract_airport_code(f.origin) as from_airport_code,
      public.profile_extract_airport_code(f.destination) as to_airport_code
    from public.flights f
    join public.trips t on t.id = f.trip_id
    join trip_participants tp on tp.trip_id = t.id
    join public.profiles p on p.id = tp.user_id
    where public.profile_trip_is_visual_eligible(t.status, t.end_date, t.is_draft, t.deleted_at, t.archived_at)
      and f.destination is not null
  ),
  prepared_flights as (
    select
      profile_user_id,
      trip_id,
      'flight'::text as source_type,
      id::text as source_id,
      coalesce((select label from public.profile_airports where code = to_airport_code), public.profile_place_clean_name(destination), 'Flight stop') as place_name,
      public.profile_place_country_code(null, null, destination, to_airport_code) as country_code,
      to_airport_code as airport_code,
      arrival_time::date as occurred_on,
      lower(nullif(direction, '')) as flight_direction,
      from_airport_code,
      coalesce((select label from public.profile_airports where code = from_airport_code), public.profile_place_clean_name(origin), 'Origin') as from_place_name,
      public.profile_place_lat(coalesce(public.profile_place_clean_name(origin), origin), from_airport_code) as from_lat,
      public.profile_place_lng(coalesce(public.profile_place_clean_name(origin), origin), from_airport_code) as from_lng,
      to_airport_code,
      coalesce((select label from public.profile_airports where code = to_airport_code), public.profile_place_clean_name(destination), 'Destination') as to_place_name,
      public.profile_place_lat(coalesce(public.profile_place_clean_name(destination), destination), to_airport_code) as to_lat,
      public.profile_place_lng(coalesce(public.profile_place_clean_name(destination), destination), to_airport_code) as to_lng,
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
    confidence,
    from_airport_code,
    from_place_name,
    from_lat,
    from_lng,
    to_airport_code,
    to_place_name,
    to_lat,
    to_lng,
    flight_direction
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
    to_lat,
    to_lng,
    occurred_on,
    case when has_companions then 'companions' else 'private' end,
    case
      when from_lat is not null and from_lng is not null and to_lat is not null and to_lng is not null then 'exact_flight'
      when to_lat is not null and to_lng is not null then 'exact_place'
      else 'country_estimate'
    end,
    from_airport_code,
    from_place_name,
    from_lat,
    from_lng,
    to_airport_code,
    to_place_name,
    to_lat,
    to_lng,
    flight_direction
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
    from_airport_code = excluded.from_airport_code,
    from_place_name = excluded.from_place_name,
    from_lat = excluded.from_lat,
    from_lng = excluded.from_lng,
    to_airport_code = excluded.to_airport_code,
    to_place_name = excluded.to_place_name,
    to_lat = excluded.to_lat,
    to_lng = excluded.to_lng,
    flight_direction = excluded.flight_direction,
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
  where m.user_id = p_user_id
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
    from_airport_code = null,
    from_place_name = null,
    from_lat = null,
    from_lng = null,
    to_airport_code = null,
    to_place_name = null,
    to_lat = null,
    to_lng = null,
    flight_direction = null,
    updated_at = now();
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
visible_places_raw as (
  select
    ptp.*,
    case
      when ptp.source_type = 'flight'
        and coalesce(nullif(upper(ptp.to_airport_code), ''), nullif(upper(ptp.airport_code), '')) = 'MNL'
        then false
      else true
    end as counts_as_place,
    case
      when coalesce(ptp.place_name, '') ilike any(array['%boracay%', '%caticlan%'])
        then 'place:boracay|PH'
      when coalesce(ptp.place_name, '') ilike '%manila%'
        then 'place:manila|PH'
      when coalesce(ptp.place_name, '') ilike '%cebu%'
        then 'place:cebu|PH'
      when coalesce(ptp.place_name, '') ilike '%hoi an%'
        then 'place:hoi-an|VN'
      when coalesce(ptp.place_name, '') ilike '%da nang%'
        then 'place:da-nang|VN'
      else lower(trim(coalesce(ptp.place_name, ''))) || '|' || coalesce(nullif(upper(ptp.country_code), ''), coalesce(ptp.country_name, ''))
    end as place_key
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
visible_trip_ids as (
  select distinct trip_id
  from visible_places_raw
  where trip_id is not null
),
visible_trips as (
  select t.*
  from public.trips t
  join visible_trip_ids vti on vti.trip_id = t.id
  where public.profile_trip_is_visual_eligible(t.status, t.end_date, t.is_draft, t.deleted_at, t.archived_at)
),
trip_stats as (
  select
    count(distinct id)::int as trip_count,
    coalesce(sum(
      case
        when total_nights is not null and total_nights > 0 then total_nights
        when start_date is not null and end_date is not null then greatest(0, end_date - start_date)
        else 0
      end
    ), 0)::int as night_count,
    coalesce(sum(coalesce(total_spent, 0)), 0)::numeric as trip_spent_total
  from visible_trips
),
expense_stats as (
  select coalesce(sum(coalesce(e.amount, 0)), 0)::numeric as expense_total
  from public.expenses e
  join visible_trip_ids vti on vti.trip_id = e.trip_id
),
visible_places as (
  select distinct on (place_key)
    *
  from visible_places_raw
  where counts_as_place
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
    count(photo_url)::int as cached_photo_count
  from visible_places_raw
  where counts_as_place
),
moment_stats as (
  select count(distinct m.id)::int as photo_count
  from public.moments m
  cross join relationship r
  where m.user_id = p_user_id
    and coalesce(m.public_url, m.hd_url) is not null
    and (
      r.is_self
      or coalesce(m.is_public, false)
      or (
        r.is_companion
        and m.trip_id in (select trip_id from visible_trip_ids)
        and coalesce(m.visibility, '') in ('companions', 'shared', 'public', 'album')
      )
    )
),
exact_flight_route_rows as (
  select
    vpr.*,
    row_number() over (
      order by occurred_on nulls last, created_at, id
    ) as rn
  from visible_places_raw vpr
  where vpr.source_type = 'flight'
    and vpr.from_lat is not null
    and vpr.from_lng is not null
    and vpr.to_lat is not null
    and vpr.to_lng is not null
),
exact_flight_route_stats as (
  select coalesce(round(sum(
    6371 * 2 * asin(sqrt(
      power(sin(radians((to_lat::double precision - from_lat::double precision) / 2)), 2) +
      cos(radians(from_lat::double precision)) * cos(radians(to_lat::double precision)) *
      power(sin(radians((to_lng::double precision - from_lng::double precision) / 2)), 2)
    ))
  )), 0)::int as km
  from exact_flight_route_rows
),
place_route_stats as (
  select
    coalesce(round(sum(
      case
        when lat is null or lng is null then 0
        else
          (
            6371 * 2 * asin(sqrt(
            power(sin(radians((lat::double precision - 14.5086) / 2)), 2) +
            cos(radians(14.5086)) * cos(radians(lat::double precision)) *
            power(sin(radians((lng::double precision - 121.0194) / 2)), 2)
            ))
          )
          * case
            when exists (
              select 1
              from visible_trips vt
              where vt.id = route_points.trip_id
                and lower(coalesce(vt.status, '')) = 'completed'
            ) then 2
            else 1
          end
      end
    )), 0)::int as km
  from (
    select distinct on (trip_id, place_key)
      trip_id,
      place_key,
      lat,
      lng
    from visible_places_raw
    where lat is not null
      and lng is not null
      and source_type <> 'flight'
    order by trip_id, place_key, case confidence
      when 'exact_place' then 1
      when 'country_estimate' then 2
      when 'text_guess' then 3
      else 4
    end
  ) route_points
),
route_stats as (
  select case
    when efrs.km > 0 then efrs.km
    else prs.km
  end as km
  from exact_flight_route_stats efrs, place_route_stats prs
),
fallback_stats as (
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
    case
      when c.place_count > 0 or ts.trip_count > 0 then greatest(c.trip_count, ts.trip_count)
      when r.is_self or r.is_companion or coalesce(pr.public_stats_enabled, false) then fs.total_trips
      else 0
    end as trips,
    case
      when c.place_count > 0 or ts.trip_count > 0 then c.country_count
      when r.is_self or r.is_companion or coalesce(pr.public_stats_enabled, false) then fs.total_countries
      else 0
    end as countries,
    c.place_count as places,
    case
      when c.place_count > 0 or ts.trip_count > 0 then ts.night_count
      when r.is_self or r.is_companion or coalesce(pr.public_stats_enabled, false) then fs.total_nights
      else 0
    end as nights,
    case
      when c.place_count > 0 or ts.trip_count > 0 then greatest(c.cached_photo_count, ms.photo_count)
      when r.is_self or r.is_companion or coalesce(pr.public_stats_enabled, false) then fs.total_moments
      else 0
    end as photos,
    case
      when c.place_count > 0 or ts.trip_count > 0 then greatest(ts.trip_spent_total, es.expense_total)
      when r.is_self or r.is_companion or coalesce(pr.public_stats_enabled, false) then fs.total_spent
      else 0
    end as spent,
    case
      when c.place_count > 0 or ts.trip_count > 0 then rs.km
      when r.is_self or r.is_companion or coalesce(pr.public_stats_enabled, false) then round(fs.total_miles * 1.60934)::int
      else 0
    end as km
  from counts c, trip_stats ts, expense_stats es, moment_stats ms, route_stats rs, fallback_stats fs, profile_row pr, relationship r
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
fallback_route_rows as (
  select
    vp.*,
    row_number() over (order by case confidence when 'exact_place' then 1 else 2 end, occurred_on desc nulls last, created_at desc) as rn
  from visible_places vp
  where lat is not null
    and lng is not null
  limit 8
),
routes as (
  select case
    when exists (select 1 from exact_flight_route_rows) then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', concat('flight-', id::text),
        'fromLabel', coalesce(from_place_name, 'Origin'),
        'fromCode', nullif(upper(from_airport_code), ''),
        'fromLat', from_lat,
        'fromLng', from_lng,
        'toLabel', coalesce(to_place_name, place_name),
        'toCode', nullif(upper(to_airport_code), ''),
        'toLat', to_lat,
        'toLng', to_lng,
        'tripId', trip_id,
        'flightId', source_id,
        'direction', flight_direction,
        'confidence', confidence,
        'featured', rn = 1
      ) order by rn), '[]'::jsonb)
      from exact_flight_route_rows
      where rn <= 10
    )
    else (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', concat('place-', id::text),
        'fromLabel', 'HOME',
        'fromCode', 'MNL',
        'toLabel', place_name,
        'toCode', nullif(upper(coalesce(airport_code, case when country_code = 'PH' then null else country_code end)), ''),
        'toLat', lat,
        'toLng', lng,
        'tripId', trip_id,
        'confidence', confidence,
        'featured', rn = 1
      ) order by rn), '[]'::jsonb)
      from fallback_route_rows
    )
  end as routes
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

revoke execute on function public.refresh_profile_travel_places_for_user(uuid) from anon, public;
revoke execute on function public.get_profile_travel_visual(uuid) from anon, public;
grant execute on function public.get_profile_travel_visual(uuid) to authenticated;
