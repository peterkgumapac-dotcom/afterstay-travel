-- Profile and invite privacy cleanup.
-- 1. Public profile lookup RPCs should only expose profiles that opted into public discovery.
-- 2. Removing a member should revoke active reusable invite codes for that trip.
-- 3. Removing a member should clean stale trip-derived companion links when no shared trip remains.

create or replace function public.search_public_profiles(
  p_query text,
  p_limit int default 20
)
returns table (
  id uuid,
  full_name text,
  handle text,
  avatar_url text
)
language sql
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.handle, p.avatar_url
  from public.profiles p
  where trim(coalesce(p_query, '')) <> ''
    and coalesce(p.profile_visibility, 'public') = 'public'
    and (
      p.handle ilike '%' || regexp_replace(trim(p_query), '^@', '') || '%'
      or p.full_name ilike '%' || trim(p_query) || '%'
    )
  order by
    case
      when lower(p.handle) = lower(regexp_replace(trim(p_query), '^@', '')) then 0
      when lower(p.full_name) = lower(trim(p_query)) then 1
      else 2
    end,
    p.full_name
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

create or replace function public.get_public_profiles(
  p_user_ids uuid[]
)
returns table (
  id uuid,
  full_name text,
  handle text,
  avatar_url text,
  companion_privacy jsonb
)
language sql
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.handle, p.avatar_url, p.companion_privacy
  from public.profiles p
  where p.id = any(p_user_ids)
    and coalesce(p.profile_visibility, 'public') = 'public';
$$;

grant execute on function public.search_public_profiles(text, int) to authenticated;
grant execute on function public.get_public_profiles(uuid[]) to authenticated;
revoke execute on function public.search_public_profiles(text, int) from anon;
revoke execute on function public.search_public_profiles(text, int) from public;
revoke execute on function public.get_public_profiles(uuid[]) from anon;
revoke execute on function public.get_public_profiles(uuid[]) from public;

create or replace function public.on_group_member_removed_privacy_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Active invite codes are reusable by design. When an organizer removes a
  -- member, expire current codes so removed or placeholder invitees cannot
  -- rejoin with the same link. Organizers can generate a fresh code immediately.
  if coalesce(old.role, 'Member') <> 'Primary' then
    update public.trip_invites
      set expires_at = least(expires_at, now()),
          used = true
    where trip_id = old.trip_id
      and expires_at > now();
  end if;

  if old.user_id is null then
    return old;
  end if;

  delete from public.companions c
  where c.source = 'trip'
    and (c.user_id = old.user_id or c.companion_id = old.user_id)
    and not exists (
      select 1
      from public.group_members a
      join public.group_members b on b.trip_id = a.trip_id
      where a.user_id = c.user_id
        and b.user_id = c.companion_id
        and a.user_id is not null
        and b.user_id is not null
        and a.user_id <> b.user_id
    );

  return old;
end;
$$;

drop trigger if exists on_group_member_removed_privacy_cleanup on public.group_members;

create trigger on_group_member_removed_privacy_cleanup
after delete on public.group_members
for each row
execute function public.on_group_member_removed_privacy_cleanup();

grant execute on function public.on_group_member_removed_privacy_cleanup() to authenticated;
