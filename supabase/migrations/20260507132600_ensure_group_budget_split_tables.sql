-- Ensure group budget split tables exist in production.
-- The app writes expense_splits after creating shared trip expenses.

create table if not exists public.expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  member_id uuid not null references public.group_members(id) on delete cascade,
  member_name text not null,
  amount numeric not null default 0,
  settled boolean default false,
  settled_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_expense_splits_expense
  on public.expense_splits(expense_id);

create index if not exists idx_expense_splits_trip
  on public.expense_splits(trip_id);

create index if not exists idx_expense_splits_member
  on public.expense_splits(member_id);

alter table public.expense_splits enable row level security;

drop policy if exists "trip members can read splits" on public.expense_splits;
create policy "trip members can read splits"
  on public.expense_splits
  for select
  using (
    exists (
      select 1
      from public.group_members
      where group_members.trip_id = expense_splits.trip_id
        and group_members.user_id = auth.uid()
    )
  );

drop policy if exists "trip members can create splits" on public.expense_splits;
create policy "trip members can create splits"
  on public.expense_splits
  for insert
  with check (
    exists (
      select 1
      from public.group_members
      where group_members.trip_id = expense_splits.trip_id
        and group_members.user_id = auth.uid()
    )
  );

drop policy if exists "trip members can update splits" on public.expense_splits;
create policy "trip members can update splits"
  on public.expense_splits
  for update
  using (
    exists (
      select 1
      from public.group_members
      where group_members.trip_id = expense_splits.trip_id
        and group_members.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.group_members
      where group_members.trip_id = expense_splits.trip_id
        and group_members.user_id = auth.uid()
    )
  );

drop policy if exists "trip members can delete splits" on public.expense_splits;
create policy "trip members can delete splits"
  on public.expense_splits
  for delete
  using (
    exists (
      select 1
      from public.group_members
      where group_members.trip_id = expense_splits.trip_id
        and group_members.user_id = auth.uid()
    )
  );

create table if not exists public.user_payment_qrs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  uri text not null,
  qr_data text,
  bank text,
  created_at timestamptz default now()
);

create index if not exists idx_user_payment_qrs_user
  on public.user_payment_qrs(user_id);

alter table public.user_payment_qrs enable row level security;

drop policy if exists "users own their payment qrs" on public.user_payment_qrs;
create policy "users own their payment qrs"
  on public.user_payment_qrs
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
