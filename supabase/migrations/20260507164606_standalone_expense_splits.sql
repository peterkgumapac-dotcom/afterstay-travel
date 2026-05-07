-- Real split rows for solo-user "Just Log It" expenses.
-- These are not trip/group records; only the expense owner can read or settle them.

create table if not exists public.standalone_expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  person_name text not null,
  amount numeric not null default 0,
  settled boolean not null default false,
  settled_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_standalone_expense_splits_expense
  on public.standalone_expense_splits(expense_id);

create index if not exists idx_standalone_expense_splits_user
  on public.standalone_expense_splits(user_id);

alter table public.standalone_expense_splits enable row level security;

drop policy if exists "users can read own standalone splits" on public.standalone_expense_splits;
create policy "users can read own standalone splits"
  on public.standalone_expense_splits
  for select
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.expenses
      where expenses.id = standalone_expense_splits.expense_id
        and expenses.trip_id is null
        and expenses.user_id = auth.uid()
    )
  );

drop policy if exists "users can create own standalone splits" on public.standalone_expense_splits;
create policy "users can create own standalone splits"
  on public.standalone_expense_splits
  for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.expenses
      where expenses.id = standalone_expense_splits.expense_id
        and expenses.trip_id is null
        and expenses.user_id = auth.uid()
    )
  );

drop policy if exists "users can update own standalone splits" on public.standalone_expense_splits;
create policy "users can update own standalone splits"
  on public.standalone_expense_splits
  for update
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.expenses
      where expenses.id = standalone_expense_splits.expense_id
        and expenses.trip_id is null
        and expenses.user_id = auth.uid()
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.expenses
      where expenses.id = standalone_expense_splits.expense_id
        and expenses.trip_id is null
        and expenses.user_id = auth.uid()
    )
  );

drop policy if exists "users can delete own standalone splits" on public.standalone_expense_splits;
create policy "users can delete own standalone splits"
  on public.standalone_expense_splits
  for delete
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.expenses
      where expenses.id = standalone_expense_splits.expense_id
        and expenses.trip_id is null
        and expenses.user_id = auth.uid()
    )
  );
