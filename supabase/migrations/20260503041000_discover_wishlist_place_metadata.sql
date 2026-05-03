-- Stabilize Discover no-trip wishlist saves.
--
-- Older local migration history created wishlist as a destination note table.
-- The app now saves individual Google Places cards for users without an active trip.

alter table public.wishlist
  add column if not exists name text,
  add column if not exists category text,
  add column if not exists google_place_id text,
  add column if not exists photo_url text,
  add column if not exists rating numeric,
  add column if not exists total_ratings integer,
  add column if not exists latitude numeric,
  add column if not exists longitude numeric,
  add column if not exists address text;

update public.wishlist
set name = coalesce(nullif(name, ''), nullif(destination, ''), 'Saved place')
where name is null or name = '';

alter table public.wishlist
  alter column name set not null,
  alter column destination drop not null;

create index if not exists wishlist_user_created_at_idx
  on public.wishlist (user_id, created_at desc);

create index if not exists wishlist_user_google_place_idx
  on public.wishlist (user_id, google_place_id)
  where google_place_id is not null;
