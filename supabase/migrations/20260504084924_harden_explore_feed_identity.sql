-- Public Explore feed should not leak profile identity for users who opted out
-- of public discovery. The post media remains public, but name/avatar are only
-- returned for public profiles or the viewer's own posts.

create or replace function public.get_explore_feed(
  p_mode text default 'recent',
  p_location text default null,
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  id uuid,
  user_id uuid,
  user_name text,
  user_avatar text,
  type text,
  caption text,
  location_name text,
  latitude numeric,
  longitude numeric,
  layout_type text,
  photo_url text,
  metadata jsonb,
  created_at timestamptz,
  likes_count int,
  comments_count int,
  share_count int,
  save_count int,
  viewer_has_liked boolean,
  viewer_has_saved boolean,
  media jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  p_limit := least(greatest(coalesce(p_limit, 20), 1), 100);
  p_offset := greatest(coalesce(p_offset, 0), 0);

  return query
  select
    fp.id,
    fp.user_id,
    case
      when fp.user_id = auth.uid()
        or coalesce(pr.profile_visibility, 'public') = 'public'
      then coalesce(pr.full_name, 'Traveler')::text
      else null::text
    end as user_name,
    case
      when fp.user_id = auth.uid()
        or coalesce(pr.profile_visibility, 'public') = 'public'
      then pr.avatar_url::text
      else null::text
    end as user_avatar,
    fp.type,
    fp.caption,
    fp.location_name,
    fp.latitude,
    fp.longitude,
    fp.layout_type,
    fp.photo_url,
    fp.metadata,
    fp.created_at,
    fp.likes_count,
    fp.comments_count,
    fp.share_count,
    fp.save_count,
    exists (
      select 1 from public.feed_post_likes fpl
      where fpl.post_id = fp.id and fpl.user_id = auth.uid()
    ) as viewer_has_liked,
    exists (
      select 1 from public.post_saves ps
      where ps.post_id = fp.id and ps.user_id = auth.uid()
    ) as viewer_has_saved,
    coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'id', pm.id,
          'mediaUrl', pm.media_url,
          'storagePath', pm.storage_path,
          'mediaType', pm.media_type,
          'width', pm.width,
          'height', pm.height,
          'orderIndex', pm.order_index
        ) order by pm.order_index)
        from public.post_media pm
        where pm.post_id = fp.id
      ),
      '[]'::jsonb
    ) as media
  from public.feed_posts fp
  left join public.profiles pr on pr.id = fp.user_id
  where fp.is_public = true
    and (p_location is null or fp.location_name ilike '%' || p_location || '%')
  order by
    case when p_mode = 'trending' then fp.likes_count + fp.comments_count + fp.share_count else 0 end desc,
    fp.created_at desc
  limit p_limit
  offset p_offset;
end;
$$;

revoke execute on function public.get_explore_feed(text, text, int, int) from anon;
revoke execute on function public.get_explore_feed(text, text, int, int) from public;
grant execute on function public.get_explore_feed(text, text, int, int) to authenticated;
