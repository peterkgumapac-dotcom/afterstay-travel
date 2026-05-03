-- Tighten notification writes so one signed-in user cannot create arbitrary
-- pushable notifications for unrelated accounts.

alter table public.notifications enable row level security;

drop policy if exists "authenticated users can insert notifications" on public.notifications;
drop policy if exists "notifications_insert_owned_or_trip_member" on public.notifications;

create policy "notifications_insert_owned_or_trip_member"
  on public.notifications
  for insert
  with check (
    auth.uid() = user_id
    or (
      trip_id is not null
      and exists (
        select 1
        from public.group_members actor
        where actor.trip_id = notifications.trip_id
          and actor.user_id = auth.uid()
      )
      and exists (
        select 1
        from public.group_members target
        where target.trip_id = notifications.trip_id
          and target.user_id = notifications.user_id
      )
    )
  );

drop policy if exists "notifications_update_own" on public.notifications;
drop policy if exists "users update own notifications" on public.notifications;

create policy "notifications_update_own"
  on public.notifications
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

do $$
begin
  if to_regprocedure('public.on_group_member_removed_privacy_cleanup()') is not null then
    revoke execute on function public.on_group_member_removed_privacy_cleanup() from authenticated;
  end if;
end $$;
