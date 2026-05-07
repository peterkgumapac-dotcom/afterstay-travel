with checks as (
  select
    'standalone_expense_splits table exists' as check_name,
    exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = 'standalone_expense_splits'
    ) as passed,
    null::text as details
  union all
  select
    'standalone_expense_splits expected columns exist' as check_name,
    count(*) = 7 as passed,
    array_agg(column_name order by column_name)::text as details
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'standalone_expense_splits'
    and column_name in (
      'id',
      'expense_id',
      'user_id',
      'person_name',
      'amount',
      'settled',
      'settled_at'
    )
  union all
  select
    'standalone_expense_splits rls enabled' as check_name,
    relrowsecurity as passed,
    null::text as details
  from pg_class
  where oid = 'public.standalone_expense_splits'::regclass
  union all
  select
    'standalone_expense_splits policies exist' as check_name,
    count(*) = 4 as passed,
    array_agg(policyname order by policyname)::text as details
  from pg_policies
  where schemaname = 'public'
    and tablename = 'standalone_expense_splits'
    and policyname in (
      'users can read own standalone splits',
      'users can create own standalone splits',
      'users can update own standalone splits',
      'users can delete own standalone splits'
    )
)
select *
from checks
order by check_name;
