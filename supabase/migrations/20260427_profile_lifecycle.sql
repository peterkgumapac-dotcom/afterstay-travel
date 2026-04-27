-- Profile lifecycle fields for user segment detection
-- Segments: new, planning, active, returning

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS trip_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_trip_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_trip_id uuid REFERENCES trips(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS onboarded_at timestamptz,
  ADD COLUMN IF NOT EXISTS user_segment text DEFAULT 'new'
    CHECK (user_segment IN ('new', 'planning', 'active', 'returning'));

-- Function: recompute segment for a given user
CREATE OR REPLACE FUNCTION compute_user_segment(uid uuid)
RETURNS text AS $$
DECLARE
  has_active boolean;
  has_completed boolean;
  has_planning boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM trips t
    JOIN group_members gm ON gm.trip_id = t.id
    WHERE gm.user_id = uid AND t.status = 'Active'
  ) INTO has_active;

  IF has_active THEN RETURN 'active'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM trips t
    JOIN group_members gm ON gm.trip_id = t.id
    WHERE gm.user_id = uid AND t.status = 'Completed'
  ) INTO has_completed;

  IF has_completed THEN RETURN 'returning'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM trips t
    JOIN group_members gm ON gm.trip_id = t.id
    WHERE gm.user_id = uid AND t.status = 'Planning'
  ) INTO has_planning;

  IF has_planning THEN RETURN 'planning'; END IF;

  RETURN 'new';
END;
$$ LANGUAGE plpgsql STABLE;

-- Trigger function: update profile when trip membership or status changes
CREATE OR REPLACE FUNCTION update_user_segment() RETURNS trigger AS $$
DECLARE
  affected_uid uuid;
BEGIN
  -- Resolve the user_id depending on which table fired the trigger
  IF TG_TABLE_NAME = 'group_members' THEN
    affected_uid := COALESCE(NEW.user_id, OLD.user_id);
  ELSIF TG_TABLE_NAME = 'trips' THEN
    -- Update all members of this trip
    FOR affected_uid IN
      SELECT user_id FROM group_members WHERE trip_id = NEW.id AND user_id IS NOT NULL
    LOOP
      UPDATE profiles SET
        trip_count = (
          SELECT count(DISTINCT t.id) FROM trips t
          JOIN group_members gm ON gm.trip_id = t.id
          WHERE gm.user_id = affected_uid
        ),
        completed_trip_count = (
          SELECT count(DISTINCT t.id) FROM trips t
          JOIN group_members gm ON gm.trip_id = t.id
          WHERE gm.user_id = affected_uid AND t.status = 'Completed'
        ),
        user_segment = compute_user_segment(affected_uid)
      WHERE id = affected_uid;
    END LOOP;
    RETURN NEW;
  END IF;

  -- For group_members trigger
  IF affected_uid IS NOT NULL THEN
    UPDATE profiles SET
      trip_count = (
        SELECT count(DISTINCT t.id) FROM trips t
        JOIN group_members gm ON gm.trip_id = t.id
        WHERE gm.user_id = affected_uid
      ),
      completed_trip_count = (
        SELECT count(DISTINCT t.id) FROM trips t
        JOIN group_members gm ON gm.trip_id = t.id
        WHERE gm.user_id = affected_uid AND t.status = 'Completed'
      ),
      last_trip_id = COALESCE(NEW.trip_id, OLD.trip_id),
      user_segment = compute_user_segment(affected_uid)
    WHERE id = affected_uid;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger on group_members changes (user joins/leaves a trip)
DROP TRIGGER IF EXISTS trg_user_segment_on_member ON group_members;
CREATE TRIGGER trg_user_segment_on_member
  AFTER INSERT OR UPDATE OR DELETE ON group_members
  FOR EACH ROW EXECUTE FUNCTION update_user_segment();

-- Trigger on trip status changes
DROP TRIGGER IF EXISTS trg_user_segment_on_trip ON trips;
CREATE TRIGGER trg_user_segment_on_trip
  AFTER UPDATE OF status ON trips
  FOR EACH ROW EXECUTE FUNCTION update_user_segment();

-- Backfill existing users
UPDATE profiles p SET
  trip_count = COALESCE(s.tc, 0),
  completed_trip_count = COALESCE(s.cc, 0),
  user_segment = compute_user_segment(p.id)
FROM (
  SELECT gm.user_id,
    count(DISTINCT t.id) AS tc,
    count(DISTINCT t.id) FILTER (WHERE t.status = 'Completed') AS cc
  FROM group_members gm
  JOIN trips t ON t.id = gm.trip_id
  WHERE gm.user_id IS NOT NULL
  GROUP BY gm.user_id
) s
WHERE p.id = s.user_id;
