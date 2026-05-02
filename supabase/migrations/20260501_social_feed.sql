-- ============================================================
-- Social Feed — public moments, counters, and feed indexes
-- ============================================================

-- ── 1. Add social columns to moments ──
ALTER TABLE moments
  ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS likes_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comments_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS day_number int,
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric;

-- ── 2. Indexes for feed queries ──

-- Public feed sorted by recency
CREATE INDEX IF NOT EXISTS idx_moments_public_feed
  ON moments (created_at DESC) WHERE is_public = true;

-- Trending feed (most liked public moments)
CREATE INDEX IF NOT EXISTS idx_moments_trending
  ON moments (likes_count DESC, created_at DESC) WHERE is_public = true;

-- Nearby feed (bounding-box lat/lng filter)
CREATE INDEX IF NOT EXISTS idx_moments_location
  ON moments (latitude, longitude) WHERE is_public = true AND latitude IS NOT NULL;

-- ── 3. RLS — allow any authenticated user to read public moments ──
DROP POLICY IF EXISTS "moments_select" ON moments;

CREATE POLICY "moments_select" ON moments FOR SELECT USING (
  -- Public moments: any authenticated user can read
  (is_public = true)
  OR
  -- Trip-scoped moments: trip member + visibility check (existing logic)
  (
    (is_trip_owner(trip_id, auth.uid()) OR is_trip_member(trip_id, auth.uid()))
    AND (visibility = 'shared' OR user_id = auth.uid())
  )
);

-- ── 4. RLS — extend comment access for public moments ──
DROP POLICY IF EXISTS "trip members can read comments" ON moment_comments;

CREATE POLICY "can read comments" ON moment_comments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM moments m WHERE m.id = moment_comments.moment_id
    AND (
      m.is_public = true
      OR EXISTS (
        SELECT 1 FROM group_members gm
        WHERE gm.trip_id = m.trip_id AND gm.user_id = auth.uid()
      )
    )
  )
);

DROP POLICY IF EXISTS "trip members can add comments" ON moment_comments;

CREATE POLICY "authenticated can comment" ON moment_comments FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM moments m WHERE m.id = moment_comments.moment_id
    AND (
      m.is_public = true
      OR EXISTS (
        SELECT 1 FROM group_members gm
        WHERE gm.trip_id = m.trip_id AND gm.user_id = auth.uid()
      )
    )
  )
);

-- ── 5. Extend favorites RLS for public moments ──
DROP POLICY IF EXISTS "Users manage their favorites" ON moment_favorites;

CREATE POLICY "users manage favorites" ON moment_favorites FOR ALL USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM moments m WHERE m.id = moment_favorites.moment_id
    AND (
      m.is_public = true
      OR is_trip_owner(m.trip_id, auth.uid())
      OR is_trip_member(m.trip_id, auth.uid())
    )
  )
);

-- ── 6. Likes count trigger ──
CREATE OR REPLACE FUNCTION update_moment_likes_count()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE moments SET likes_count = likes_count + 1 WHERE id = NEW.moment_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE moments SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.moment_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_moment_likes_count ON moment_favorites;
CREATE TRIGGER trg_moment_likes_count
  AFTER INSERT OR DELETE ON moment_favorites
  FOR EACH ROW EXECUTE FUNCTION update_moment_likes_count();

-- ── 7. Comments count trigger ──
CREATE OR REPLACE FUNCTION update_moment_comments_count()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE moments SET comments_count = comments_count + 1 WHERE id = NEW.moment_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE moments SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.moment_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_moment_comments_count ON moment_comments;
CREATE TRIGGER trg_moment_comments_count
  AFTER INSERT OR DELETE ON moment_comments
  FOR EACH ROW EXECUTE FUNCTION update_moment_comments_count();

-- ── 8. Backfill existing counts ──
UPDATE moments m SET
  likes_count = COALESCE((
    SELECT count(*) FROM moment_favorites mf WHERE mf.moment_id = m.id
  ), 0),
  comments_count = COALESCE((
    SELECT count(*) FROM moment_comments mc WHERE mc.moment_id = m.id
  ), 0);
