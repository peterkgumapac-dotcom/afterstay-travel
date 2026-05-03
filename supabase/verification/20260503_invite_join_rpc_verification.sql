-- Read-only verification for invite join hardening.
-- Expected:
-- - join_trip_by_invite_code exists and is callable by authenticated users.
-- - direct group member inserts are admin-only.
-- - reusable invite-code trip reads are not exposed by a broad trips policy.

select
  p.proname,
  pg_get_function_arguments(p.oid) as arguments,
  coalesce(has_function_privilege('authenticated', p.oid, 'EXECUTE'), false) as authenticated_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'join_trip_by_invite_code';

select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and (
    (tablename = 'group_members' and policyname in ('group_members_insert', 'group_members_select', 'group_members_update', 'group_members_delete'))
    or (tablename = 'trip_invites' and policyname like 'trip_invites_%')
    or (tablename = 'trips' and policyname = 'trips_select_via_invite')
  )
order by tablename, policyname;
