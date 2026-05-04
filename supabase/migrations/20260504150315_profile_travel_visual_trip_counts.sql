-- Public profile counts must come from the same visible travel rows that power
-- the Travel Flex visual. lifetime_stats is only a last-resort fallback for
-- users who have no normalized profile_travel_places yet.

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
    coalesce(sum(coalesce(total_spent, 0)), 0)::numeric as spent_total
  from visible_trips
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
    count(photo_url)::int as cached_photo_count
  from visible_places_raw
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
route_stats as (
  select
    coalesce(round(sum(
      case
        when lat is null or lng is null then 0
        else
          6371 * 2 * asin(sqrt(
            power(sin(radians((lat::double precision - 14.5086) / 2)), 2) +
            cos(radians(14.5086)) * cos(radians(lat::double precision)) *
            power(sin(radians((lng::double precision - 121.0194) / 2)), 2)
          ))
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
    order by trip_id, place_key, case confidence
      when 'exact_flight' then 1
      when 'exact_place' then 2
      when 'country_estimate' then 3
      when 'text_guess' then 4
      else 5
    end
  ) route_points
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
      when c.place_count > 0 or ts.trip_count > 0 then ts.spent_total
      when r.is_self or r.is_companion or coalesce(pr.public_stats_enabled, false) then fs.total_spent
      else 0
    end as spent,
    case
      when c.place_count > 0 or ts.trip_count > 0 then rs.km
      when r.is_self or r.is_companion or coalesce(pr.public_stats_enabled, false) then round(fs.total_miles * 1.60934)::int
      else 0
    end as km
  from counts c, trip_stats ts, moment_stats ms, route_stats rs, fallback_stats fs, profile_row pr, relationship r
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
