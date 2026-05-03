-- Companion linking hardening.
-- Existing companion trigger handled INSERT into group_members, but invite flows
-- can link a pre-added placeholder by UPDATE-ing user_id. This makes both paths
-- create accepted trip companions and backfills any missed pairs.

create or replace function public.auto_add_companions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null then
    return new;
  end if;

  insert into public.companions (user_id, companion_id, status, source)
  select new.user_id, gm.user_id, 'accepted', 'trip'
  from public.group_members gm
  where gm.trip_id = new.trip_id
    and gm.user_id is not null
    and gm.user_id != new.user_id
  on conflict (user_id, companion_id) do update
    set status = 'accepted',
        source = 'trip';

  insert into public.companions (user_id, companion_id, status, source)
  select gm.user_id, new.user_id, 'accepted', 'trip'
  from public.group_members gm
  where gm.trip_id = new.trip_id
    and gm.user_id is not null
    and gm.user_id != new.user_id
  on conflict (user_id, companion_id) do update
    set status = 'accepted',
        source = 'trip';

  return new;
end;
$$;

drop trigger if exists on_member_joined_companion on public.group_members;

create trigger on_member_joined_companion
after insert or update of user_id on public.group_members
for each row
when (new.user_id is not null)
execute function public.auto_add_companions();

insert into public.companions (user_id, companion_id, status, source)
select distinct a.user_id, b.user_id, 'accepted', 'trip'
from public.group_members a
join public.group_members b on a.trip_id = b.trip_id
where a.user_id is not null
  and b.user_id is not null
  and a.user_id != b.user_id
on conflict (user_id, companion_id) do update
  set status = 'accepted',
      source = 'trip';
