select
  'expenses.daily_category exists' as check_name,
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'expenses'
      and column_name = 'daily_category'
  ) as ok;

select
  'expense write policies exist' as check_name,
  count(*) filter (
    where policyname in ('expenses_insert', 'expenses_update')
  ) >= 2 as ok,
  array_agg(policyname order by policyname) as policies
from pg_policies
where schemaname = 'public'
  and tablename = 'expenses';
