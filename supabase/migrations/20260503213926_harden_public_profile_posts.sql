-- Harden public profile posts.
-- Public feed posts remain public in Explore, but the profile-surface RPC should
-- only expose those posts when the author's profile itself is public.

create or replace function public.get_public_profile_posts(
  p_user_id uuid,
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  id uuid,
  user_id uuid,
  type text,
  caption text,
  photo_url text,
  location_name text,
  latitude numeric,
  longitude numeric,
  layout_type text,
  metadata jsonb,
  created_at timestamptz,
  likes_count int,
  comments_count int,
  share_count int,
  save_count int,
  media jsonb
)
language sql
security definer
set search_path = public
as $$
  select
    fp.id,
    fp.user_id,
    fp.type,
    fp.caption,
    fp.photo_url,
    fp.location_name,
    fp.latitude,
    fp.longitude,
    fp.layout_type,
    '{}'::jsonb as metadata,
    fp.created_at,
    fp.likes_count,
    fp.comments_count,
    fp.share_count,
    fp.save_count,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pm.id,
        'mediaUrl', pm.media_url,
        'storagePath', pm.storage_path,
        'mediaType', pm.media_type,
        'orderIndex', pm.order_index
      ) order by pm.order_index)
      from public.post_media pm
      where pm.post_id = fp.id
    ), '[]'::jsonb) as media
  from public.feed_posts fp
  join public.profiles p on p.id = fp.user_id
  where fp.user_id = p_user_id
    and fp.is_public = true
    and coalesce(p.profile_visibility, 'public') = 'public'
  order by fp.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke execute on function public.get_public_profile_posts(uuid, int, int) from anon;
revoke execute on function public.get_public_profile_posts(uuid, int, int) from public;
grant execute on function public.get_public_profile_posts(uuid, int, int) to authenticated;

-- Trigger functions should not be directly callable by app clients.
revoke execute on function public.on_group_member_removed_privacy_cleanup() from anon;
revoke execute on function public.on_group_member_removed_privacy_cleanup() from public;
revoke execute on function public.on_group_member_removed_privacy_cleanup() from authenticated;
