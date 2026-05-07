-- Trip expenses power group budgets and settle-up. Keep them visible to trip
-- members even if an older client omits the visibility field.

update public.expenses
set visibility = 'shared'
where trip_id is not null
  and visibility = 'private';

create or replace function public.ensure_trip_expense_shared_visibility()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.trip_id is not null and coalesce(new.visibility, 'private') = 'private' then
    new.visibility := 'shared';
  end if;
  return new;
end;
$$;

drop trigger if exists ensure_trip_expense_shared_visibility on public.expenses;
create trigger ensure_trip_expense_shared_visibility
  before insert or update of trip_id, visibility
  on public.expenses
  for each row
  execute function public.ensure_trip_expense_shared_visibility();

revoke execute on function public.ensure_trip_expense_shared_visibility() from anon;
revoke execute on function public.ensure_trip_expense_shared_visibility() from public;
