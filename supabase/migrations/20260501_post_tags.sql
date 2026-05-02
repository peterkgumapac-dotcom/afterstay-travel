-- ============================================================
-- Post Tags — tag people in feed posts
-- ============================================================

CREATE TABLE IF NOT EXISTS post_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  tagged_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tagged_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (post_id, tagged_user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_tags_post ON post_tags(post_id);
CREATE INDEX IF NOT EXISTS idx_post_tags_user ON post_tags(tagged_user_id, created_at DESC);

ALTER TABLE post_tags ENABLE ROW LEVEL SECURITY;

-- Anyone can see tags on public posts
CREATE POLICY "tags readable on public posts" ON post_tags FOR SELECT USING (
  EXISTS (SELECT 1 FROM feed_posts WHERE feed_posts.id = post_tags.post_id AND (feed_posts.is_public = true OR feed_posts.user_id = auth.uid()))
);

-- Post owner can tag people
CREATE POLICY "post owner can tag" ON post_tags FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM feed_posts WHERE feed_posts.id = post_tags.post_id AND feed_posts.user_id = auth.uid())
);

-- Post owner or tagged user can remove tag
CREATE POLICY "owner or tagged user can untag" ON post_tags FOR DELETE USING (
  tagged_user_id = auth.uid() OR
  EXISTS (SELECT 1 FROM feed_posts WHERE feed_posts.id = post_tags.post_id AND feed_posts.user_id = auth.uid())
);
