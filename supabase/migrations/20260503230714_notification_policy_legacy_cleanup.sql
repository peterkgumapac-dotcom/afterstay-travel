-- Remove legacy notification grants that survived the first hardening pass.
-- The app should only allow self-notifications or trip-scoped member
-- notifications through notifications_insert_owned_or_trip_member.

drop policy if exists "trip members can insert notifications" on public.notifications;

do $$
begin
  if to_regprocedure('public.on_group_member_removed_privacy_cleanup()') is not null then
    revoke execute on function public.on_group_member_removed_privacy_cleanup() from public;
    revoke execute on function public.on_group_member_removed_privacy_cleanup() from anon;
    revoke execute on function public.on_group_member_removed_privacy_cleanup() from authenticated;
  end if;
end $$;
