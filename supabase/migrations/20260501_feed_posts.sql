-- ============================================================
-- Feed Posts — multi-type social newsfeed
-- ============================================================

CREATE TABLE IF NOT EXISTS feed_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('photo','text','trip_summary','budget','recommendation','trip_invite')),
  caption text,
  moment_id uuid REFERENCES moments(id) ON DELETE SET NULL,
  trip_id uuid REFERENCES trips(id) ON DELETE SET NULL,
  expense_id uuid,
  place_id uuid,
  photo_url text,
  metadata jsonb DEFAULT '{}',
  location_name text,
  latitude numeric,
  longitude numeric,
  likes_count int DEFAULT 0,
  comments_count int DEFAULT 0,
  is_public boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feed_posts_user ON feed_posts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_posts_public ON feed_posts(created_at DESC) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_feed_posts_trending ON feed_posts(likes_count DESC, created_at DESC) WHERE is_public = true;

ALTER TABLE feed_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public posts readable" ON feed_posts;
CREATE POLICY "public posts readable" ON feed_posts FOR SELECT USING (is_public = true OR user_id = auth.uid());
DROP POLICY IF EXISTS "users create own" ON feed_posts;
CREATE POLICY "users create own" ON feed_posts FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "users delete own" ON feed_posts;
CREATE POLICY "users delete own" ON feed_posts FOR DELETE USING (user_id = auth.uid());

-- ── Likes ──
CREATE TABLE IF NOT EXISTS feed_post_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_feed_post_likes_post ON feed_post_likes(post_id);
ALTER TABLE feed_post_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users manage own likes" ON feed_post_likes;
CREATE POLICY "users manage own likes" ON feed_post_likes FOR ALL USING (user_id = auth.uid());
DROP POLICY IF EXISTS "anyone can read likes" ON feed_post_likes;
CREATE POLICY "anyone can read likes" ON feed_post_likes FOR SELECT USING (true);

-- ── Comments ──
CREATE TABLE IF NOT EXISTS feed_post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text text NOT NULL CHECK (length(text) > 0 AND length(text) <= 500),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_feed_post_comments_post ON feed_post_comments(post_id, created_at);
ALTER TABLE feed_post_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public comments readable" ON feed_post_comments;
CREATE POLICY "public comments readable" ON feed_post_comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "auth users comment" ON feed_post_comments;
CREATE POLICY "auth users comment" ON feed_post_comments FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "users delete own comments" ON feed_post_comments;
CREATE POLICY "users delete own comments" ON feed_post_comments FOR DELETE USING (user_id = auth.uid());

-- ── Likes count trigger ──
CREATE OR REPLACE FUNCTION update_feed_post_likes_count()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE feed_posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE feed_posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_feed_post_likes_count ON feed_post_likes;
CREATE TRIGGER trg_feed_post_likes_count
  AFTER INSERT OR DELETE ON feed_post_likes
  FOR EACH ROW EXECUTE FUNCTION update_feed_post_likes_count();

-- ── Comments count trigger ──
CREATE OR REPLACE FUNCTION update_feed_post_comments_count()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE feed_posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE feed_posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_feed_post_comments_count ON feed_post_comments;
CREATE TRIGGER trg_feed_post_comments_count
  AFTER INSERT OR DELETE ON feed_post_comments
  FOR EACH ROW EXECUTE FUNCTION update_feed_post_comments_count();
