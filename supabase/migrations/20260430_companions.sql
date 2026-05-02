-- ============================================================
-- Companion System — social layer for travel buddies
-- Auto-adds companions when users share a trip.
-- Manual add via profile view.
-- ============================================================

-- ── Companions table ──
CREATE TABLE IF NOT EXISTS companions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  companion_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending','accepted')) DEFAULT 'pending',
  source text NOT NULL CHECK (source IN ('trip','manual')) DEFAULT 'manual',
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, companion_id),
  CHECK (user_id != companion_id)
);

CREATE INDEX IF NOT EXISTS idx_companions_user ON companions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_companions_companion ON companions(companion_id, status);

ALTER TABLE companions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own companions"
  ON companions FOR SELECT USING (
    user_id = auth.uid() OR companion_id = auth.uid()
  );

CREATE POLICY "users send requests"
  ON companions FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "users accept requests"
  ON companions FOR UPDATE USING (companion_id = auth.uid());

CREATE POLICY "either side can remove"
  ON companions FOR DELETE USING (
    user_id = auth.uid() OR companion_id = auth.uid()
  );

-- ── Privacy preferences on profiles ──
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  companion_privacy jsonb DEFAULT '{
    "showStats": true,
    "showSharedMoments": true,
    "showPastTrips": true,
    "showUpcomingTrips": false,
    "showSocials": true
  }'::jsonb;

-- ── Auto-add companions when a member joins a trip ──
CREATE OR REPLACE FUNCTION auto_add_companions()
RETURNS trigger AS $$
BEGIN
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;

  -- Forward direction: new member → existing members
  INSERT INTO companions (user_id, companion_id, status, source)
  SELECT NEW.user_id, gm.user_id, 'accepted', 'trip'
  FROM group_members gm
  WHERE gm.trip_id = NEW.trip_id
    AND gm.user_id IS NOT NULL
    AND gm.user_id != NEW.user_id
  ON CONFLICT (user_id, companion_id) DO NOTHING;

  -- Reverse direction: existing members → new member
  INSERT INTO companions (user_id, companion_id, status, source)
  SELECT gm.user_id, NEW.user_id, 'accepted', 'trip'
  FROM group_members gm
  WHERE gm.trip_id = NEW.trip_id
    AND gm.user_id IS NOT NULL
    AND gm.user_id != NEW.user_id
  ON CONFLICT (user_id, companion_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_member_joined_companion
  AFTER INSERT ON group_members
  FOR EACH ROW EXECUTE FUNCTION auto_add_companions();

-- ── Backfill: create companion entries for existing trip co-members ──
INSERT INTO companions (user_id, companion_id, status, source)
SELECT DISTINCT a.user_id, b.user_id, 'accepted', 'trip'
FROM group_members a
JOIN group_members b ON a.trip_id = b.trip_id
WHERE a.user_id IS NOT NULL
  AND b.user_id IS NOT NULL
  AND a.user_id != b.user_id
ON CONFLICT (user_id, companion_id) DO NOTHING;
