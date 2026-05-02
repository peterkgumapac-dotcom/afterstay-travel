-- Group invite + admin hardening
-- - Shared invite codes stay reusable until expiry.
-- - Only the trip owner/Primary member can remove trip members.
-- - Joined members can read and contribute shared trip essentials.
-- - Invited companions can confirm shared stay and keep personal flight deltas.

ALTER TABLE IF EXISTS public.group_members
  ADD COLUMN IF NOT EXISTS shares_accommodation boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS travel_notes text;

ALTER TABLE IF EXISTS public.flights
  ADD COLUMN IF NOT EXISTS seat_number text;

CREATE OR REPLACE FUNCTION public.is_trip_owner(p_trip_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.trips t
    WHERE t.id = p_trip_id
      AND t.user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_trip_member(p_trip_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.trip_id = p_trip_id
      AND gm.user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_trip_admin(p_trip_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_trip_owner(p_trip_id, p_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.group_members gm
      WHERE gm.trip_id = p_trip_id
        AND gm.user_id = p_user_id
        AND gm.role = 'Primary'
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_trip_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_trip_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_trip_admin(uuid, uuid) TO authenticated;

-- Invite codes are group codes. "used" is kept as history, not as an access gate.
DROP POLICY IF EXISTS "trips_select_via_invite" ON public.trips;
CREATE POLICY "trips_select_via_invite" ON public.trips
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.trip_invites ti
    WHERE ti.trip_id = trips.id
      AND ti.expires_at > now()
  )
);

-- All trip members should see the group roster. Admin-only operations are below.
DROP POLICY IF EXISTS "Users can view group members from own trips" ON public.group_members;
DROP POLICY IF EXISTS "group_members_select" ON public.group_members;
CREATE POLICY "group_members_select" ON public.group_members
FOR SELECT
USING (
  public.is_trip_owner(trip_id, auth.uid())
  OR public.is_trip_member(trip_id, auth.uid())
);

DROP POLICY IF EXISTS "group_members_insert" ON public.group_members;
CREATE POLICY "group_members_insert" ON public.group_members
FOR INSERT
WITH CHECK (
  public.is_trip_admin(trip_id, auth.uid())
  OR (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.trip_invites ti
      WHERE ti.trip_id = group_members.trip_id
        AND ti.expires_at > now()
    )
  )
);

DROP POLICY IF EXISTS "group_members_update" ON public.group_members;
CREATE POLICY "group_members_update" ON public.group_members
FOR UPDATE
USING (
  public.is_trip_admin(trip_id, auth.uid())
  OR user_id = auth.uid()
)
WITH CHECK (
  public.is_trip_admin(trip_id, auth.uid())
  OR user_id = auth.uid()
);

DROP POLICY IF EXISTS "group_members_delete" ON public.group_members;
CREATE POLICY "group_members_delete" ON public.group_members
FOR DELETE
USING (
  role <> 'Primary'
  AND public.is_trip_admin(trip_id, auth.uid())
);

-- Shared trip essentials: members can read the same trip planning surface.
DROP POLICY IF EXISTS "Users can view flights from own trips" ON public.flights;
DROP POLICY IF EXISTS "flights_select" ON public.flights;
CREATE POLICY "flights_select" ON public.flights
FOR SELECT
USING (
  public.is_trip_owner(trip_id, auth.uid())
  OR public.is_trip_member(trip_id, auth.uid())
);

DROP POLICY IF EXISTS "flights_insert" ON public.flights;
CREATE POLICY "flights_insert" ON public.flights
FOR INSERT
WITH CHECK (
  public.is_trip_owner(trip_id, auth.uid())
  OR public.is_trip_member(trip_id, auth.uid())
);

DROP POLICY IF EXISTS "flights_update" ON public.flights;
CREATE POLICY "flights_update" ON public.flights
FOR UPDATE
USING (
  public.is_trip_owner(trip_id, auth.uid())
  OR public.is_trip_member(trip_id, auth.uid())
)
WITH CHECK (
  public.is_trip_owner(trip_id, auth.uid())
  OR public.is_trip_member(trip_id, auth.uid())
);

DROP POLICY IF EXISTS "flights_delete" ON public.flights;
CREATE POLICY "flights_delete" ON public.flights
FOR DELETE
USING (
  public.is_trip_owner(trip_id, auth.uid())
  OR public.is_trip_member(trip_id, auth.uid())
);

DROP POLICY IF EXISTS "Users can view expenses from own trips" ON public.expenses;
DROP POLICY IF EXISTS "expenses_select" ON public.expenses;
CREATE POLICY "expenses_select" ON public.expenses
FOR SELECT
USING (
  public.is_trip_owner(trip_id, auth.uid())
  OR public.is_trip_member(trip_id, auth.uid())
);

DROP POLICY IF EXISTS "Users can view places from own trips" ON public.places;
DROP POLICY IF EXISTS "places_select" ON public.places;
CREATE POLICY "places_select" ON public.places
FOR SELECT
USING (
  public.is_trip_owner(trip_id, auth.uid())
  OR public.is_trip_member(trip_id, auth.uid())
);

DROP POLICY IF EXISTS "places_insert" ON public.places;
CREATE POLICY "places_insert" ON public.places
FOR INSERT
WITH CHECK (
  public.is_trip_owner(trip_id, auth.uid())
  OR public.is_trip_member(trip_id, auth.uid())
);

DROP POLICY IF EXISTS "places_update" ON public.places;
CREATE POLICY "places_update" ON public.places
FOR UPDATE
USING (
  public.is_trip_owner(trip_id, auth.uid())
  OR public.is_trip_member(trip_id, auth.uid())
)
WITH CHECK (
  public.is_trip_owner(trip_id, auth.uid())
  OR public.is_trip_member(trip_id, auth.uid())
);

DROP POLICY IF EXISTS "trip_files_select" ON public.trip_files;
CREATE POLICY "trip_files_select" ON public.trip_files
FOR SELECT
USING (
  public.is_trip_owner(trip_id, auth.uid())
  OR public.is_trip_member(trip_id, auth.uid())
);
