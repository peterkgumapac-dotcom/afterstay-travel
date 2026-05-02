-- Durable onboarding progress for resumable new-user setup.
alter table public.profiles
add column if not exists onboarding_state jsonb not null default '{}'::jsonb;

comment on column public.profiles.onboarding_state is
  'Resumable onboarding state: path, stage, trip id, metadata, completion timestamps.';

create or replace function public.update_own_onboarding_state(
  p_state jsonb,
  p_onboarded_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.profiles (id, onboarding_state, onboarded_at)
  values (auth.uid(), coalesce(p_state, '{}'::jsonb), p_onboarded_at)
  on conflict (id) do update
    set onboarding_state = excluded.onboarding_state,
        onboarded_at = coalesce(excluded.onboarded_at, public.profiles.onboarded_at);
end;
$$;

grant execute on function public.update_own_onboarding_state(jsonb, timestamptz) to authenticated;
