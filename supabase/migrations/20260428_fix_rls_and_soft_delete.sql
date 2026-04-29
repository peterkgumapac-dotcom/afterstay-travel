-- 1. Add soft-delete columns (if not already added)
ALTER TABLE trips
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- 2. Enable RLS on trips
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

-- 3. Drop any conflicting policies
DROP POLICY IF EXISTS "Users can view own trips" ON trips;
DROP POLICY IF EXISTS "Users can create own trips" ON trips;
DROP POLICY IF EXISTS "Users can update own trips" ON trips;
DROP POLICY IF EXISTS "Users can delete own trips" ON trips;

-- 4. Create RLS policies for trips
-- Allow users to view their own trips + trips where they're a member
CREATE POLICY "Users can view own trips"
ON trips FOR SELECT
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM group_members 
    WHERE group_members.trip_id = trips.id 
    AND group_members.user_id = auth.uid()
  )
);

-- Allow users to create trips
CREATE POLICY "Users can create own trips"
ON trips FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own trips
CREATE POLICY "Users can update own trips"
ON trips FOR UPDATE
USING (auth.uid() = user_id);

-- Allow users to delete their own trips
CREATE POLICY "Users can delete own trips"
ON trips FOR DELETE
USING (auth.uid() = user_id);

-- 5. Enable RLS on related tables (if not already)
ALTER TABLE IF EXISTS moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS flights ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS places ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS group_members ENABLE ROW LEVEL SECURITY;

-- 6. Create basic SELECT policies for related tables
DROP POLICY IF EXISTS "Users can view moments from own trips" ON moments;
CREATE POLICY "Users can view moments from own trips"
ON moments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM trips 
    WHERE trips.id = moments.trip_id 
    AND (trips.user_id = auth.uid() OR trips.deleted_at IS NULL)
  )
);

DROP POLICY IF EXISTS "Users can view flights from own trips" ON flights;
CREATE POLICY "Users can view flights from own trips"
ON flights FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM trips 
    WHERE trips.id = flights.trip_id 
    AND trips.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can view expenses from own trips" ON expenses;
CREATE POLICY "Users can view expenses from own trips"
ON expenses FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM trips 
    WHERE trips.id = expenses.trip_id 
    AND trips.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can view places from own trips" ON places;
CREATE POLICY "Users can view places from own trips"
ON places FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM trips 
    WHERE trips.id = places.trip_id 
    AND trips.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can view group members from own trips" ON group_members;
CREATE POLICY "Users can view group members from own trips"
ON group_members FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM trips 
    WHERE trips.id = group_members.trip_id 
    AND trips.user_id = auth.uid()
  )
  OR user_id = auth.uid()
);

-- 7. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_trips_user_id ON trips(user_id);
CREATE INDEX IF NOT EXISTS idx_trips_deleted_at ON trips(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_trips_archived_at ON trips(archived_at) WHERE archived_at IS NULL;
