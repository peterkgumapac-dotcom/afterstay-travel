-- ============================================================
-- Explore Moments — rich posts, saves, shares, stories
-- ============================================================

-- ── Extend feed_posts with layout + save/share counts ──
ALTER TABLE feed_posts
  ADD COLUMN IF NOT EXISTS layout_type text CHECK (layout_type IN ('single','carousel','polaroid_stack','grid')),
  ADD COLUMN IF NOT EXISTS save_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS share_count int DEFAULT 0;

-- Expand type check (drop old, add new)
ALTER TABLE feed_posts DROP CONSTRAINT IF EXISTS feed_posts_type_check;
ALTER TABLE feed_posts ADD CONSTRAINT feed_posts_type_check
  CHECK (type IN ('photo','text','trip_summary','budget','recommendation','trip_invite','carousel','collage','story_reference'));

-- ── Post Media (multi-image support) ──
CREATE TABLE IF NOT EXISTS post_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  media_url text NOT NULL,
  storage_path text NOT NULL,
  media_type text DEFAULT 'image',
  width int,
  height int,
  order_index int NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_post_media_post ON post_media(post_id, order_index);
ALTER TABLE post_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "media readable if post readable" ON post_media;
CREATE POLICY "media readable if post readable" ON post_media FOR SELECT USING (
  EXISTS (SELECT 1 FROM feed_posts WHERE feed_posts.id = post_media.post_id AND (feed_posts.is_public = true OR feed_posts.user_id = auth.uid()))
);
DROP POLICY IF EXISTS "owner inserts media" ON post_media;
CREATE POLICY "owner inserts media" ON post_media FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM feed_posts WHERE feed_posts.id = post_media.post_id AND feed_posts.user_id = auth.uid())
);
DROP POLICY IF EXISTS "owner deletes media" ON post_media;
CREATE POLICY "owner deletes media" ON post_media FOR DELETE USING (
  EXISTS (SELECT 1 FROM feed_posts WHERE feed_posts.id = post_media.post_id AND feed_posts.user_id = auth.uid())
);

-- ── Post Saves (bookmarks) ──
CREATE TABLE IF NOT EXISTS post_saves (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);
ALTER TABLE post_saves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users manage own saves" ON post_saves;
CREATE POLICY "users manage own saves" ON post_saves FOR ALL USING (user_id = auth.uid());

-- Save count trigger
CREATE OR REPLACE FUNCTION update_feed_post_save_count()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE feed_posts SET save_count = save_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE feed_posts SET save_count = GREATEST(save_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_feed_post_save_count ON post_saves;
CREATE TRIGGER trg_feed_post_save_count
  AFTER INSERT OR DELETE ON post_saves
  FOR EACH ROW EXECUTE FUNCTION update_feed_post_save_count();

-- ── Post Shares ──
CREATE TABLE IF NOT EXISTS post_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  share_target text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE post_shares ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users manage own shares" ON post_shares;
CREATE POLICY "users manage own shares" ON post_shares FOR ALL USING (user_id = auth.uid());

-- Share count trigger
CREATE OR REPLACE FUNCTION update_feed_post_share_count()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE feed_posts SET share_count = share_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE feed_posts SET share_count = GREATEST(share_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_feed_post_share_count ON post_shares;
CREATE TRIGGER trg_feed_post_share_count
  AFTER INSERT OR DELETE ON post_shares
  FOR EACH ROW EXECUTE FUNCTION update_feed_post_share_count();

-- ── Stories (24h ephemeral) ──
CREATE TABLE IF NOT EXISTS stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_url text NOT NULL,
  storage_path text NOT NULL,
  caption text,
  place_id text,
  location_name text,
  visibility text DEFAULT 'public',
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '24 hours')
);
CREATE INDEX IF NOT EXISTS idx_stories_user_created ON stories(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_expires_at ON stories(expires_at);
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public stories readable" ON stories;
CREATE POLICY "public stories readable" ON stories FOR SELECT USING (
  (visibility = 'public' AND expires_at > now()) OR user_id = auth.uid()
);
DROP POLICY IF EXISTS "users create own stories" ON stories;
CREATE POLICY "users create own stories" ON stories FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "users delete own stories" ON stories;
CREATE POLICY "users delete own stories" ON stories FOR DELETE USING (user_id = auth.uid());

-- ── Story Views ──
CREATE TABLE IF NOT EXISTS story_views (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  story_id uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  viewed_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, story_id)
);
ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users manage own views" ON story_views;
CREATE POLICY "users manage own views" ON story_views FOR ALL USING (user_id = auth.uid());

-- ── RPC: get_explore_feed ──
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
