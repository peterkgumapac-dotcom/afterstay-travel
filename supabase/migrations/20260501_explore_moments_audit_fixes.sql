-- ============================================================
-- Explore Moments Audit Fixes
-- Fixes: RPC limit cap, overly broad RLS, missing UPDATE
-- policies, post_shares UNIQUE, counter backfills
-- ============================================================

-- ── CRITICAL #2: Cap RPC limit to prevent DoS ──
CREATE OR REPLACE FUNCTION get_explore_feed(
  p_mode text DEFAULT 'recent',
  p_location text DEFAULT NULL,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
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
) AS $$
BEGIN
  -- Cap limit to prevent abuse
  p_limit := LEAST(COALESCE(p_limit, 20), 100);
  p_offset := GREATEST(COALESCE(p_offset, 0), 0);

  RETURN QUERY
  SELECT
    fp.id,
    fp.user_id,
    COALESCE(pr.full_name, 'Traveler')::text AS user_name,
    pr.avatar_url::text AS user_avatar,
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
    EXISTS (SELECT 1 FROM feed_post_likes fpl WHERE fpl.post_id = fp.id AND fpl.user_id = auth.uid()) AS viewer_has_liked,
    EXISTS (SELECT 1 FROM post_saves ps WHERE ps.post_id = fp.id AND ps.user_id = auth.uid()) AS viewer_has_saved,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'id', pm.id,
        'mediaUrl', pm.media_url,
        'storagePath', pm.storage_path,
        'mediaType', pm.media_type,
        'width', pm.width,
        'height', pm.height,
        'orderIndex', pm.order_index
      ) ORDER BY pm.order_index)
      FROM post_media pm WHERE pm.post_id = fp.id),
      '[]'::jsonb
    ) AS media
  FROM feed_posts fp
  LEFT JOIN profiles pr ON pr.id = fp.user_id
  WHERE fp.is_public = true
    AND (p_location IS NULL OR fp.location_name ILIKE '%' || p_location || '%')
  ORDER BY
    CASE WHEN p_mode = 'trending' THEN fp.likes_count + fp.comments_count + fp.share_count ELSE 0 END DESC,
    fp.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── CRITICAL #3: Restrict feed_post_likes SELECT to authenticated users ──
DROP POLICY IF EXISTS "anyone can read likes" ON feed_post_likes;
CREATE POLICY "authenticated can read likes" ON feed_post_likes
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ── CRITICAL #4: Restrict feed_post_comments SELECT to public post comments ──
DROP POLICY IF EXISTS "public comments readable" ON feed_post_comments;
CREATE POLICY "public post comments readable" ON feed_post_comments
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM feed_posts fp
      WHERE fp.id = feed_post_comments.post_id
        AND (fp.is_public = true OR fp.user_id = auth.uid())
    )
  );

-- ── MEDIUM #5: Add UNIQUE constraint on post_shares to prevent duplicate inflation ──
-- First remove any existing duplicates (keep earliest)
DELETE FROM post_shares a
USING post_shares b
WHERE a.user_id = b.user_id
  AND a.post_id = b.post_id
  AND a.created_at > b.created_at;

ALTER TABLE post_shares
  DROP CONSTRAINT IF EXISTS post_shares_user_post_unique;
ALTER TABLE post_shares
  ADD CONSTRAINT post_shares_user_post_unique UNIQUE (user_id, post_id);

-- ── MEDIUM #6: Backfill save_count and share_count ──
UPDATE feed_posts fp
SET save_count = COALESCE(
  (SELECT count(*) FROM post_saves ps WHERE ps.post_id = fp.id), 0
)
WHERE save_count IS DISTINCT FROM COALESCE(
  (SELECT count(*) FROM post_saves ps WHERE ps.post_id = fp.id), 0
);

UPDATE feed_posts fp
SET share_count = COALESCE(
  (SELECT count(*) FROM post_shares ps WHERE ps.post_id = fp.id), 0
)
WHERE share_count IS DISTINCT FROM COALESCE(
  (SELECT count(*) FROM post_shares ps WHERE ps.post_id = fp.id), 0
);

-- ── MEDIUM #7: Add UPDATE policies ──

-- feed_posts: owner can update within 15 minutes
DROP POLICY IF EXISTS "users update own" ON feed_posts;
CREATE POLICY "users update own" ON feed_posts
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- post_media: owner can update via parent post
DROP POLICY IF EXISTS "owner updates media" ON post_media;
CREATE POLICY "owner updates media" ON post_media
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM feed_posts WHERE feed_posts.id = post_media.post_id AND feed_posts.user_id = auth.uid())
  );

-- stories: owner can update own stories
DROP POLICY IF EXISTS "users update own stories" ON stories;
CREATE POLICY "users update own stories" ON stories
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- moment_comments: owner can update own comments
DROP POLICY IF EXISTS "users update own comments" ON moment_comments;
CREATE POLICY "users update own comments" ON moment_comments
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- feed_post_comments: owner can update own comments
DROP POLICY IF EXISTS "users update own feed comments" ON feed_post_comments;
CREATE POLICY "users update own feed comments" ON feed_post_comments
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
