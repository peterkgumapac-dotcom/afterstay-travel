-- Migration: Standalone expenses (no trip) + expense location persistence
-- Date: 2026-04-27

-- 1. Make trip_id nullable so standalone expenses can exist
ALTER TABLE expenses ALTER COLUMN trip_id DROP NOT NULL;

-- 2. Add user_id for standalone expense ownership
--    (trip expenses inherit ownership from trip membership)
ALTER TABLE expenses ADD COLUMN user_id uuid REFERENCES auth.users(id);

-- 3. Add lat/lng columns (UI already collects via Google Places, never persisted)
ALTER TABLE expenses ADD COLUMN place_latitude numeric;
ALTER TABLE expenses ADD COLUMN place_longitude numeric;

-- 4. Index for standalone expense queries
CREATE INDEX idx_expenses_user_standalone ON expenses(user_id) WHERE trip_id IS NULL;

-- 5. RLS policies for standalone expenses (trip_id IS NULL)
CREATE POLICY "standalone_select" ON expenses FOR SELECT
  USING (trip_id IS NULL AND user_id = auth.uid());

CREATE POLICY "standalone_insert" ON expenses FOR INSERT
  WITH CHECK (trip_id IS NULL AND user_id = auth.uid());

CREATE POLICY "standalone_update" ON expenses FOR UPDATE
  USING (trip_id IS NULL AND user_id = auth.uid());

CREATE POLICY "standalone_delete" ON expenses FOR DELETE
  USING (trip_id IS NULL AND user_id = auth.uid());
