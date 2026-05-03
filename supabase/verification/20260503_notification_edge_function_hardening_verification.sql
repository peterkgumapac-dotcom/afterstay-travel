select policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'notifications'
order by policyname;

select
  p.proname,
  has_function_privilege('authenticated', p.oid, 'execute') as auth_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'on_group_member_removed_privacy_cleanup';
