-- Normalize legacy Explore moments so the canonical visibility column matches
-- the older is_public flag. The app now treats visibility='public' as the
-- source of truth for public Explore publishing.
alter table public.moments
  drop constraint if exists moments_visibility_check;

alter table public.moments
  add constraint moments_visibility_check
  check (visibility in ('shared', 'private', 'album', 'public'));

update public.moments
set visibility = 'public',
    updated_at = now()
where is_public = true
  and visibility is distinct from 'public';
