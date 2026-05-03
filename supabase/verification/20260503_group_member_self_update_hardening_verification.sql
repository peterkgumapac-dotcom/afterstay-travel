-- Read-only verification for group member self-update hardening.
-- Expected:
-- - direct group_members_update no longer includes "user_id = auth.uid()"
-- - safe self-update RPCs exist and are callable by authenticated
-- - join_trip_by_invite_code still exists after replacement
-- - shares_accommodation no longer has a true default for new placeholders

select
  policyname,
  cmd,
  roles::text as roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'group_members'
  and policyname = 'group_members_update';

select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as arguments,
  coalesce(has_function_privilege('authenticated', p.oid, 'EXECUTE'), false) as authenticated_can_execute,
  coalesce(has_function_privilege('anon', p.oid, 'EXECUTE'), false) as anon_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'join_trip_by_invite_code',
    'update_own_trip_member_preferences',
    'update_trip_member_contact'
  )
order by p.proname, arguments;

select
  column_name,
  column_default,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'group_members'
  and column_name in ('shares_accommodation', 'travel_notes');
