-- Group member self-update hardening.
-- Prevent members from promoting themselves to Primary while preserving safe
-- self-service updates through SECURITY DEFINER RPCs.

alter table if exists public.group_members
  alter column shares_accommodation drop default;

update public.group_members
set shares_accommodation = null
where user_id is null
  and travel_notes is null
  and shares_accommodation = true;

create or replace function public.update_own_trip_member_preferences(
  p_trip_id uuid,
  p_shares_accommodation boolean default null,
  p_travel_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_member_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  update public.group_members
    set shares_accommodation = coalesce(p_shares_accommodation, shares_accommodation),
        travel_notes = case
          when p_travel_notes is null then travel_notes
          else nullif(trim(p_travel_notes), '')
        end
  where trip_id = p_trip_id
    and user_id = v_user_id
  returning id into v_member_id;

  if v_member_id is null then
    raise exception 'Trip member row not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.update_trip_member_contact(
  p_member_id uuid,
  p_email text default null,
  p_phone text default null,
  p_avatar_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_member public.group_members%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select *
    into v_member
  from public.group_members
  where id = p_member_id;

  if not found then
    raise exception 'Trip member row not found' using errcode = 'P0002';
  end if;

  if not (
    v_member.user_id = v_user_id
    or public.is_trip_admin(v_member.trip_id, v_user_id)
  ) then
    raise exception 'Organizer access required' using errcode = '42501';
  end if;

  update public.group_members
    set email = case when p_email is null then email else nullif(trim(p_email), '') end,
        phone = case when p_phone is null then phone else nullif(trim(p_phone), '') end,
        avatar_url = case when p_avatar_url is null then avatar_url else nullif(trim(p_avatar_url), '') end
  where id = p_member_id;
end;
$$;

grant execute on function public.update_own_trip_member_preferences(uuid, boolean, text) to authenticated;
grant execute on function public.update_trip_member_contact(uuid, text, text, text) to authenticated;
revoke execute on function public.update_own_trip_member_preferences(uuid, boolean, text) from anon;
revoke execute on function public.update_own_trip_member_preferences(uuid, boolean, text) from public;
revoke execute on function public.update_trip_member_contact(uuid, text, text, text) from anon;
revoke execute on function public.update_trip_member_contact(uuid, text, text, text) from public;

-- Direct member-row updates are organizer-only. Non-organizers update only
-- whitelisted personal fields through the RPCs above.
drop policy if exists "group_members_update" on public.group_members;
create policy "group_members_update"
on public.group_members
for update
using (
  auth.uid() is not null
  and public.is_trip_admin(trip_id, auth.uid())
)
with check (
  auth.uid() is not null
  and public.is_trip_admin(trip_id, auth.uid())
);

-- Replace invite join RPC so placeholder claiming requires verified auth email.
-- A traveler typing another placeholder's display name should create a separate
-- member row, not take ownership of that placeholder.
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
