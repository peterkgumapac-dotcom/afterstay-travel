-- Saved Ideas follow-up for Discover.
-- Adds source references for public posts/trips and dedupes Google Places saves per user.

alter table public.wishlist
  add column if not exists source_post_id uuid references public.feed_posts(id) on delete set null,
  add column if not exists source_trip_id uuid references public.trips(id) on delete set null;

with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, google_place_id
      order by created_at desc nulls last, id desc
    ) as rn
  from public.wishlist
  where google_place_id is not null
)
delete from public.wishlist w
using ranked r
where w.id = r.id
  and r.rn > 1;

create unique index if not exists wishlist_user_google_place_unique_idx
  on public.wishlist (user_id, google_place_id)
  where google_place_id is not null;

create index if not exists wishlist_user_source_post_idx
  on public.wishlist (user_id, source_post_id)
  where source_post_id is not null;

create index if not exists wishlist_user_source_trip_idx
  on public.wishlist (user_id, source_trip_id)
  where source_trip_id is not null;
