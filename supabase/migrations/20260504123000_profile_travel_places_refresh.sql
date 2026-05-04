-- Keep the Travel Flex cache current after trips, flights, moments, or trip
-- membership changes. This intentionally rebuilds one user's cache at a time
-- from source tables so profile numbers keep one source of truth.

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
    updated_at = now();
end;
$$;

create or replace function public.refresh_own_profile_travel_places()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_profile_travel_places_for_user(auth.uid());
end;
$$;

create or replace function public.refresh_profile_travel_places_for_trip(p_trip_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
begin
  for target_user_id in
    select user_id from public.trips where id = p_trip_id and user_id is not null
    union
    select user_id from public.group_members where trip_id = p_trip_id and user_id is not null
  loop
    perform public.refresh_profile_travel_places_for_user(target_user_id);
  end loop;
end;
$$;

create or replace function public.profile_travel_places_refresh_trip_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_profile_travel_places_for_trip(coalesce(new.id, old.id));
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.profile_travel_places_refresh_flight_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_profile_travel_places_for_trip(coalesce(new.trip_id, old.trip_id));
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.profile_travel_places_refresh_member_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_profile_travel_places_for_trip(coalesce(new.trip_id, old.trip_id));
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.profile_travel_places_refresh_moment_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_profile_travel_places_for_user(coalesce(new.user_id, old.user_id));
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_refresh_profile_travel_places_on_trip on public.trips;
create trigger trg_refresh_profile_travel_places_on_trip
after insert or update or delete on public.trips
for each row execute function public.profile_travel_places_refresh_trip_trigger();

drop trigger if exists trg_refresh_profile_travel_places_on_flight on public.flights;
create trigger trg_refresh_profile_travel_places_on_flight
after insert or update or delete on public.flights
for each row execute function public.profile_travel_places_refresh_flight_trigger();

drop trigger if exists trg_refresh_profile_travel_places_on_group_member on public.group_members;
create trigger trg_refresh_profile_travel_places_on_group_member
after insert or update or delete on public.group_members
for each row execute function public.profile_travel_places_refresh_member_trigger();

drop trigger if exists trg_refresh_profile_travel_places_on_moment on public.moments;
create trigger trg_refresh_profile_travel_places_on_moment
after insert or update or delete on public.moments
for each row execute function public.profile_travel_places_refresh_moment_trigger();

revoke execute on function public.refresh_profile_travel_places_for_user(uuid) from anon, public;
revoke execute on function public.refresh_profile_travel_places_for_trip(uuid) from anon, public;
revoke execute on function public.profile_travel_places_refresh_trip_trigger() from anon, public;
revoke execute on function public.profile_travel_places_refresh_flight_trigger() from anon, public;
revoke execute on function public.profile_travel_places_refresh_member_trigger() from anon, public;
revoke execute on function public.profile_travel_places_refresh_moment_trigger() from anon, public;
revoke execute on function public.refresh_own_profile_travel_places() from anon, public;
grant execute on function public.refresh_own_profile_travel_places() to authenticated;
