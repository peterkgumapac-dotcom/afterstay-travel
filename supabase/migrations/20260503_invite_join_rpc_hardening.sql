-- Invite join hardening.
-- Move code validation and member linking into a SECURITY DEFINER RPC so
-- clients do not need broad trip/member policies for active invite codes.

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
    select id
      into v_member_id
    from public.group_members
    where trip_id = v_invite.trip_id
      and user_id is null
      and (
        (v_email is not null and lower(coalesce(email, '')) = v_email)
        or lower(coalesce(name, '')) = lower(v_name)
      )
    order by created_at asc nulls last
    limit 1;

    if v_member_id is not null then
      update public.group_members
        set name = v_name,
            user_id = v_user_id,
            email = coalesce(email, v_email),
            role = coalesce(role, 'Member')
      where id = v_member_id;
    else
      insert into public.group_members (trip_id, name, role, user_id, email)
      values (v_invite.trip_id, v_name, 'Member', v_user_id, v_email);
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

-- With the RPC live, possession of a code is proven inside the function.
-- Direct table insert should be reserved for trip admins.
drop policy if exists "group_members_insert" on public.group_members;
create policy "group_members_insert" on public.group_members
for insert
with check (
  auth.uid() is not null
  and public.is_trip_admin(trip_id, auth.uid())
);

-- Do not expose trips just because they have an active reusable invite.
drop policy if exists "trips_select_via_invite" on public.trips;

-- Explicit invite policies: admins can manage invite rows; joiners use the RPC.
alter table public.trip_invites enable row level security;

drop policy if exists "trip_invites_select_admin" on public.trip_invites;
create policy "trip_invites_select_admin"
on public.trip_invites
for select
using (
  auth.uid() is not null
  and public.is_trip_admin(trip_id, auth.uid())
);

drop policy if exists "trip_invites_insert_admin" on public.trip_invites;
create policy "trip_invites_insert_admin"
on public.trip_invites
for insert
with check (
  auth.uid() is not null
  and public.is_trip_admin(trip_id, auth.uid())
);

drop policy if exists "trip_invites_update" on public.trip_invites;
drop policy if exists "trip_invites_update_admin" on public.trip_invites;
create policy "trip_invites_update_admin"
on public.trip_invites
for update
using (
  auth.uid() is not null
  and public.is_trip_admin(trip_id, auth.uid())
)
with check (
  auth.uid() is not null
  and public.is_trip_admin(trip_id, auth.uid())
);

drop policy if exists "trip_invites_delete_admin" on public.trip_invites;
create policy "trip_invites_delete_admin"
on public.trip_invites
for delete
using (
  auth.uid() is not null
  and public.is_trip_admin(trip_id, auth.uid())
);
