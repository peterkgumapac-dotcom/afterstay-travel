-- Travel stat share tokens for animated constellation pages
create table if not exists travel_stat_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  display_name text,
  created_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '30 days'),
  unique (user_id)
);

alter table travel_stat_shares enable row level security;

create policy "users can manage own shares"
  on travel_stat_shares for all using (auth.uid() = user_id);
