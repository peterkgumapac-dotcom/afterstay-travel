-- ============================================================
-- Moment Comments — photo comments for shared moments
-- ============================================================

CREATE TABLE IF NOT EXISTS moment_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  moment_id uuid NOT NULL REFERENCES moments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text text NOT NULL CHECK (length(text) > 0 AND length(text) <= 500),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_moment_comments_moment ON moment_comments(moment_id, created_at);
CREATE INDEX IF NOT EXISTS idx_moment_comments_user ON moment_comments(user_id);

ALTER TABLE moment_comments ENABLE ROW LEVEL SECURITY;

-- Trip members can read comments on moments they can see
CREATE POLICY "trip members can read comments"
  ON moment_comments FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM moments m
      JOIN group_members gm ON gm.trip_id = m.trip_id
      WHERE m.id = moment_comments.moment_id
        AND gm.user_id = auth.uid()
    )
  );

-- Trip members can add comments
CREATE POLICY "trip members can add comments"
  ON moment_comments FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM moments m
      JOIN group_members gm ON gm.trip_id = m.trip_id
      WHERE m.id = moment_comments.moment_id
        AND gm.user_id = auth.uid()
    )
  );

-- Users can delete their own comments
CREATE POLICY "users delete own comments"
  ON moment_comments FOR DELETE USING (user_id = auth.uid());
