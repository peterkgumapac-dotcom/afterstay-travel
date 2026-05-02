-- ============================================================
-- Multi-User Data Isolation Fix
-- Pre-launch blocker: ensures each user sees only their own
-- private data within shared trips.
-- ============================================================

-- ── 1a. Moments: merge two conflicting SELECT policies into one ──
-- Old policies: "Users can view moments from own trips" (no visibility check)
--               "moments_select" (has visibility check but includes user_id IS NULL bypass)
-- New: trip member + (shared OR own moments only)

DROP POLICY IF EXISTS "Users can view moments from own trips" ON moments;
DROP POLICY IF EXISTS "moments_select" ON moments;

CREATE POLICY "moments_select" ON moments FOR SELECT USING (
  (is_trip_owner(trip_id, auth.uid()) OR is_trip_member(trip_id, auth.uid()))
  AND (visibility = 'shared' OR user_id = auth.uid())
);


-- ── 1b. Albums: only owner or explicit album_members can read ──
-- Old: "Trip members can read albums" — every trip member sees every album
-- New: owner OR invited via album_members

DROP POLICY IF EXISTS "Trip members can read albums" ON albums;

CREATE POLICY "Album owner or member can read" ON albums FOR SELECT USING (
  owner_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM album_members
    WHERE album_members.album_id = albums.id
      AND album_members.user_id = auth.uid()
  )
);


-- ── 1c. Fix DELETE policies — allow trip members to delete, not just owner ──
-- Old pattern: trips.user_id = auth.uid() OR trips.user_id IS NULL
-- New pattern: is_trip_owner OR is_trip_member (consistent with INSERT/UPDATE)

DROP POLICY IF EXISTS "moments_delete" ON moments;
CREATE POLICY "moments_delete" ON moments FOR DELETE USING (
  is_trip_owner(trip_id, auth.uid()) OR is_trip_member(trip_id, auth.uid())
);

DROP POLICY IF EXISTS "flights_delete" ON flights;
CREATE POLICY "flights_delete" ON flights FOR DELETE USING (
  is_trip_owner(trip_id, auth.uid()) OR is_trip_member(trip_id, auth.uid())
);

DROP POLICY IF EXISTS "expenses_delete" ON expenses;
CREATE POLICY "expenses_delete" ON expenses FOR DELETE USING (
  is_trip_owner(trip_id, auth.uid()) OR is_trip_member(trip_id, auth.uid())
);

DROP POLICY IF EXISTS "places_delete" ON places;
CREATE POLICY "places_delete" ON places FOR DELETE USING (
  is_trip_owner(trip_id, auth.uid()) OR is_trip_member(trip_id, auth.uid())
);

DROP POLICY IF EXISTS "packing_items_delete" ON packing_items;
CREATE POLICY "packing_items_delete" ON packing_items FOR DELETE USING (
  is_trip_owner(trip_id, auth.uid()) OR is_trip_member(trip_id, auth.uid())
);

DROP POLICY IF EXISTS "checklist_items_delete" ON checklist_items;
CREATE POLICY "checklist_items_delete" ON checklist_items FOR DELETE USING (
  is_trip_owner(trip_id, auth.uid()) OR is_trip_member(trip_id, auth.uid())
);

DROP POLICY IF EXISTS "trip_files_delete" ON trip_files;
CREATE POLICY "trip_files_delete" ON trip_files FOR DELETE USING (
  is_trip_owner(trip_id, auth.uid()) OR is_trip_member(trip_id, auth.uid())
);

DROP POLICY IF EXISTS "group_members_delete" ON group_members;
CREATE POLICY "group_members_delete" ON group_members FOR DELETE USING (
  is_trip_owner(trip_id, auth.uid()) OR is_trip_member(trip_id, auth.uid())
);


-- ── 1d. Fix joinTripByCode: allow trip lookup via valid invite ──
-- Without this, a user with a valid invite code can't SELECT the trip
-- because they're not yet a group_member.

CREATE POLICY "trips_select_via_invite" ON trips FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM trip_invites
    WHERE trip_invites.trip_id = trips.id
      AND trip_invites.used = false
      AND trip_invites.expires_at > now()
  )
);


-- ── 1e. Fix trip_files UPDATE — allow trip members, not just owner ──

DROP POLICY IF EXISTS "trip_files_update" ON trip_files;
CREATE POLICY "trip_files_update" ON trip_files FOR UPDATE USING (
  is_trip_owner(trip_id, auth.uid()) OR is_trip_member(trip_id, auth.uid())
);
