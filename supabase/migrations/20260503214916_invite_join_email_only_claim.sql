-- Final invite join hardening.
-- A reusable trip code proves access to the trip, but it should not let a
-- traveler claim an existing placeholder member row by typing the same display
-- name. Placeholder ownership is linked only when the authenticated email
-- matches the pre-added placeholder email.

create or replace function public.join_trip_by_invite_code(
  p_code text,
  p_name text default null
)
returns public.trips
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_email text := nullif(lower(coalesce(auth.jwt() ->> 'email', '')), '');
  v_invite public.trip_invites%rowtype;
  v_trip public.trips%rowtype;
  v_member_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if v_code = '' then
    raise exception 'Invite code is required' using errcode = '22023';
  end if;

  select *
    into v_invite
  from public.trip_invites
  where upper(code) = v_code
    and expires_at > now()
  order by created_at desc
  limit 1;

  if not found then
    raise exception 'Invalid or expired invite code' using errcode = '22023';
  end if;

  select *
    into v_trip
  from public.trips
  where id = v_invite.trip_id
    and deleted_at is null;

  if not found then
    raise exception 'Trip not found' using errcode = 'P0002';
  end if;

  if v_name is null then
    v_name := coalesce(split_part(v_email, '@', 1), 'Traveler');
  end if;

  select id
    into v_member_id
  from public.group_members
  where trip_id = v_invite.trip_id
    and user_id = v_user_id
  limit 1;

  if v_member_id is not null then
    update public.group_members
      set name = v_name
    where id = v_member_id;
  else
    if v_email is not null then
      select id
        into v_member_id
      from public.group_members
      where trip_id = v_invite.trip_id
        and user_id is null
        and lower(coalesce(email, '')) = v_email
      order by created_at asc nulls last
      limit 1;
    end if;

    if v_member_id is not null then
      update public.group_members
        set name = v_name,
            user_id = v_user_id,
            email = coalesce(email, v_email),
            role = coalesce(role, 'Member')
      where id = v_member_id;
    else
      insert into public.group_members (trip_id, name, role, user_id, email, shares_accommodation)
      values (v_invite.trip_id, v_name, 'Member', v_user_id, v_email, null);
    end if;
  end if;

  update public.trip_invites
    set used = true
  where id = v_invite.id;

  return v_trip;
end;
$$;

grant execute on function public.join_trip_by_invite_code(text, text) to authenticated;
revoke execute on function public.join_trip_by_invite_code(text, text) from anon;
revoke execute on function public.join_trip_by_invite_code(text, text) from public;
