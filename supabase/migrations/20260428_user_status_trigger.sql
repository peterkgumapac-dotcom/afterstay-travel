-- Migration: Auto-sync profiles.user_segment from trips table
-- This keeps the profile segment in sync even when trips are mutated
-- outside the app (e.g., via admin tools, edge functions, or bulk imports).

-- Drop existing trigger/function if they exist (idempotent)
DROP TRIGGER IF EXISTS trg_update_segment_on_trip ON trips;
DROP FUNCTION IF EXISTS update_user_segment();

CREATE OR REPLACE FUNCTION update_user_segment()
RETURNS TRIGGER AS $$
DECLARE
  target_user_id UUID;
  active_count INT;
  planning_count INT;
  completed_count INT;
  new_segment TEXT;
BEGIN
  -- Determine which user_id to recalc
  IF TG_OP = 'DELETE' THEN
    target_user_id := OLD.user_id;
  ELSE
    target_user_id := NEW.user_id;
  END IF;

  IF target_user_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COUNT(*) INTO active_count
  FROM trips
  WHERE user_id = target_user_id
    AND status = 'Active'
    AND deleted_at IS NULL
    AND archived_at IS NULL;

  SELECT COUNT(*) INTO planning_count
  FROM trips
  WHERE user_id = target_user_id
    AND status = 'Planning'
    AND deleted_at IS NULL
    AND archived_at IS NULL
    AND is_draft IS NULL;

  SELECT COUNT(*) INTO completed_count
  FROM trips
  WHERE user_id = target_user_id
    AND status = 'Completed'
    AND deleted_at IS NULL;

  new_segment := CASE
    WHEN active_count > 0 THEN 'active'
    WHEN planning_count > 0 THEN 'planning'
    WHEN completed_count > 0 THEN 'returning'
    ELSE 'new'
  END;

  UPDATE profiles
  SET user_segment = new_segment
  WHERE id = target_user_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_segment_on_trip
AFTER INSERT OR UPDATE OR DELETE ON trips
FOR EACH ROW
EXECUTE FUNCTION update_user_segment();

-- Backfill existing profiles so they match their current trips
UPDATE profiles
SET user_segment = sub.segment
FROM (
  SELECT
    p.id AS user_id,
    CASE
      WHEN COUNT(t.*) FILTER (WHERE t.status = 'Active' AND t.deleted_at IS NULL AND t.archived_at IS NULL) > 0 THEN 'active'
      WHEN COUNT(t.*) FILTER (WHERE t.status = 'Planning' AND t.deleted_at IS NULL AND t.archived_at IS NULL AND t.is_draft IS NULL) > 0 THEN 'planning'
      WHEN COUNT(t.*) FILTER (WHERE t.status = 'Completed' AND t.deleted_at IS NULL) > 0 THEN 'returning'
      ELSE 'new'
    END AS segment
  FROM profiles p
  LEFT JOIN trips t ON t.user_id = p.id
  GROUP BY p.id
) sub
WHERE profiles.id = sub.user_id;
