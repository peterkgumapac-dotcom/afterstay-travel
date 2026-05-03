select
  p.proname,
  pg_get_functiondef(p.oid) ilike '%and lower(coalesce(email%' as claims_placeholder_by_email,
  pg_get_functiondef(p.oid) not ilike '%lower(coalesce(name%' as does_not_claim_by_name,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec,
  has_function_privilege('public', p.oid, 'EXECUTE') as public_exec,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_exec
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'join_trip_by_invite_code';
