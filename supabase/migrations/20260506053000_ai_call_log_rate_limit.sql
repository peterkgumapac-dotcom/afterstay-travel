-- ai_call_log — per-user rate limiting for the ai-proxy Edge Function.
--
-- Why: ai-proxy gates on auth, but any authenticated user can otherwise call
-- it without limit. trip-scan / trip-memory request up to 4096 tokens with
-- multimodal payloads, so a single bad actor could burn the team's
-- Anthropic bill overnight. This table tracks calls so the function can
-- enforce a daily quota per user.
--
-- Schema is intentionally minimal — a row per successful proxy call, plus
-- one index on (user_id, created_at) for the lookback query the function
-- runs on every request.

create table if not exists public.ai_call_log (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  action      text        not null,
  tokens_in   integer,
  tokens_out  integer,
  created_at  timestamptz not null default now()
);

create index if not exists ai_call_log_user_recent
  on public.ai_call_log (user_id, created_at desc);

alter table public.ai_call_log enable row level security;

-- Users may read their own usage (so the app can show "X of Y AI calls used
-- today" if you want it later). They cannot insert / update / delete —
-- writes happen exclusively from the Edge Function via the service role.
create policy "users_read_own_ai_call_log"
  on public.ai_call_log
  for select
  using (auth.uid() = user_id);

-- Comment so future readers know who's writing the table.
comment on table public.ai_call_log is
  'Per-call audit + rate-limit table for ai-proxy Edge Function. Writes happen via service role from supabase/functions/ai-proxy.';
