alter table if exists public.expenses
  add column if not exists daily_category text;

create index if not exists expenses_daily_tracker_idx
  on public.expenses (user_id, expense_date desc)
  where trip_id is null and daily_category is not null;

drop policy if exists "expenses_insert" on public.expenses;
create policy "expenses_insert"
on public.expenses
for insert
with check (
  auth.uid() is not null
  and (
    (trip_id is null and user_id = auth.uid())
    or (
      trip_id is not null
      and (
        public.is_trip_owner(trip_id, auth.uid())
        or public.is_trip_member(trip_id, auth.uid())
      )
    )
  )
);

drop policy if exists "expenses_update" on public.expenses;
create policy "expenses_update"
on public.expenses
for update
using (
  auth.uid() is not null
  and (
    (trip_id is null and user_id = auth.uid())
    or (
      trip_id is not null
      and (
        public.is_trip_owner(trip_id, auth.uid())
        or public.is_trip_member(trip_id, auth.uid())
      )
    )
  )
)
with check (
  auth.uid() is not null
  and (
    (trip_id is null and user_id = auth.uid())
    or (
      trip_id is not null
      and (
        public.is_trip_owner(trip_id, auth.uid())
        or public.is_trip_member(trip_id, auth.uid())
      )
    )
  )
);
