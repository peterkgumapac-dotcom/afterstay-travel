-- Backend security cleanup for May 2 media/new-user/Explore stabilization.
-- Safe/idempotent hardening after verification showed the required app schema is present.

-- Curated lists are app-read data. Keep clients from writing directly.
alter table if exists public.curated_lists enable row level security;

drop policy if exists "curated_lists_authenticated_read" on public.curated_lists;
create policy "curated_lists_authenticated_read"
on public.curated_lists
for select
using (auth.role() = 'authenticated');

-- Invite codes should not be globally updateable.
drop policy if exists "trip_invites_update" on public.trip_invites;
create policy "trip_invites_update"
on public.trip_invites
for update
using (
  auth.uid() is not null
  and (
    public.is_trip_owner(trip_id, auth.uid())
    or public.is_trip_member(trip_id, auth.uid())
  )
)
with check (
  auth.uid() is not null
  and (
    public.is_trip_owner(trip_id, auth.uid())
    or public.is_trip_member(trip_id, auth.uid())
  )
);

-- Public buckets can serve object URLs without a broad object listing policy.
drop policy if exists "Public read moments" on storage.objects;

-- App RPCs are called after sign-in or by internal triggers. Do not expose
-- SECURITY DEFINER functions to the anon role through PostgREST.
revoke execute on function public.get_explore_feed(text, text, integer, integer) from anon;
revoke execute on function public.get_explore_feed(text, text, integer, integer) from public;
revoke execute on function public.get_public_profile(uuid) from anon;
revoke execute on function public.get_public_profile(uuid) from public;
revoke execute on function public.get_public_profile_posts(uuid, integer, integer) from anon;
revoke execute on function public.get_public_profile_posts(uuid, integer, integer) from public;
revoke execute on function public.get_public_profiles(uuid[]) from anon;
revoke execute on function public.get_public_profiles(uuid[]) from public;
revoke execute on function public.handle_expense_notification() from anon;
revoke execute on function public.handle_expense_notification() from public;
revoke execute on function public.handle_member_joined_notification() from anon;
revoke execute on function public.handle_member_joined_notification() from public;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.is_handle_available(text, uuid) from anon;
revoke execute on function public.is_handle_available(text, uuid) from public;
revoke execute on function public.is_trip_admin(uuid, uuid) from anon;
revoke execute on function public.is_trip_admin(uuid, uuid) from public;
revoke execute on function public.is_trip_member(uuid, uuid) from anon;
revoke execute on function public.is_trip_member(uuid, uuid) from public;
revoke execute on function public.is_trip_owner(uuid, uuid) from anon;
revoke execute on function public.is_trip_owner(uuid, uuid) from public;
revoke execute on function public.notify_push_on_insert() from anon;
revoke execute on function public.notify_push_on_insert() from public;
revoke execute on function public.replace_trip_flights_from_scan(uuid, jsonb) from anon;
revoke execute on function public.replace_trip_flights_from_scan(uuid, jsonb) from public;
revoke execute on function public.save_own_push_tokens(text, text, text, boolean) from anon;
revoke execute on function public.save_own_push_tokens(text, text, text, boolean) from public;
revoke execute on function public.search_public_profiles(text, integer) from anon;
revoke execute on function public.search_public_profiles(text, integer) from public;
revoke execute on function public.update_own_onboarding_state(jsonb, timestamptz) from anon;
revoke execute on function public.update_own_onboarding_state(jsonb, timestamptz) from public;
revoke execute on function public.upsert_own_profile(text, text, text, text, jsonb) from anon;
revoke execute on function public.upsert_own_profile(text, text, text, text, jsonb) from public;

-- Re-grant the app role explicitly for RPCs that clients call.
grant execute on function public.get_explore_feed(text, text, integer, integer) to authenticated;
grant execute on function public.get_public_profile(uuid) to authenticated;
grant execute on function public.get_public_profile_posts(uuid, integer, integer) to authenticated;
grant execute on function public.get_public_profiles(uuid[]) to authenticated;
grant execute on function public.is_handle_available(text, uuid) to authenticated;
grant execute on function public.is_trip_admin(uuid, uuid) to authenticated;
grant execute on function public.is_trip_member(uuid, uuid) to authenticated;
grant execute on function public.is_trip_owner(uuid, uuid) to authenticated;
grant execute on function public.replace_trip_flights_from_scan(uuid, jsonb) to authenticated;
grant execute on function public.save_own_push_tokens(text, text, text, boolean) to authenticated;
grant execute on function public.search_public_profiles(text, integer) to authenticated;
grant execute on function public.update_own_onboarding_state(jsonb, timestamptz) to authenticated;
grant execute on function public.upsert_own_profile(text, text, text, text, jsonb) to authenticated;
