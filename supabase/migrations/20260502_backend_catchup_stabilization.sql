-- Backend catch-up stabilization
-- Safe to run more than once. Brings manually-applied production fixes
-- into a single tracked migration for profiles, invites, push, storage,
-- public profile lookup, and common performance indexes.

-- ── Profiles / push tokens ───────────────────────────────────────────

ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS fcm_token text,
  ADD COLUMN IF NOT EXISTS push_provider text DEFAULT 'firebase',
  ADD COLUMN IF NOT EXISTS expo_push_token text,
  ADD COLUMN IF NOT EXISTS push_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS companion_privacy jsonb DEFAULT
    '{"showStats": true, "showSocials": true, "showPastTrips": true, "showSharedMoments": true, "showUpcomingTrips": false}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_profiles_handle_lower
  ON public.profiles (lower(handle))
  WHERE handle IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_push_enabled
  ON public.profiles (push_enabled)
  WHERE push_enabled = true;

CREATE OR REPLACE FUNCTION public.is_handle_available(
  p_handle text,
  p_current_user_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE lower(handle) = lower(trim(p_handle))
      AND (p_current_user_id IS NULL OR id <> p_current_user_id)
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_handle_available(text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.upsert_own_profile(
  p_full_name text DEFAULT NULL,
  p_handle text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_socials jsonb DEFAULT NULL
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_profile public.profiles;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.profiles (
    id,
    full_name,
    handle,
    avatar_url,
    phone,
    socials
  )
  VALUES (
    v_uid,
    COALESCE(p_full_name, ''),
    NULLIF(trim(lower(p_handle)), ''),
    NULLIF(p_avatar_url, ''),
    NULLIF(p_phone, ''),
    COALESCE(p_socials, '{}'::jsonb)
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(p_full_name, public.profiles.full_name),
    handle = CASE
      WHEN p_handle IS NULL THEN public.profiles.handle
      ELSE NULLIF(trim(lower(p_handle)), '')
    END,
    avatar_url = CASE
      WHEN p_avatar_url IS NULL THEN public.profiles.avatar_url
      ELSE NULLIF(p_avatar_url, '')
    END,
    phone = CASE
      WHEN p_phone IS NULL THEN public.profiles.phone
      ELSE NULLIF(p_phone, '')
    END,
    socials = COALESCE(p_socials, public.profiles.socials),
    updated_at = now()
  RETURNING * INTO v_profile;

  RETURN v_profile;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_own_profile(text, text, text, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.search_public_profiles(
  p_query text,
  p_limit int DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  full_name text,
  handle text,
  avatar_url text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.handle, p.avatar_url
  FROM public.profiles p
  WHERE trim(coalesce(p_query, '')) <> ''
    AND (
      p.handle ILIKE '%' || regexp_replace(trim(p_query), '^@', '') || '%'
      OR p.full_name ILIKE '%' || trim(p_query) || '%'
    )
  ORDER BY
    CASE
      WHEN lower(p.handle) = lower(regexp_replace(trim(p_query), '^@', '')) THEN 0
      WHEN lower(p.full_name) = lower(trim(p_query)) THEN 1
      ELSE 2
    END,
    p.full_name
  LIMIT LEAST(GREATEST(coalesce(p_limit, 20), 1), 50);
$$;

CREATE OR REPLACE FUNCTION public.get_public_profiles(
  p_user_ids uuid[]
)
RETURNS TABLE (
  id uuid,
  full_name text,
  handle text,
  avatar_url text,
  companion_privacy jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.handle, p.avatar_url, p.companion_privacy
  FROM public.profiles p
  WHERE p.id = ANY(p_user_ids);
$$;

GRANT EXECUTE ON FUNCTION public.search_public_profiles(text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) TO authenticated;

-- ── Trip/group invite hardening ──────────────────────────────────────

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

-- ── Storage buckets / upload paths ───────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('moments', 'moments', true),
  ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "authenticated can read public app media" ON storage.objects;
CREATE POLICY "authenticated can read public app media"
ON storage.objects
FOR SELECT
USING (
  bucket_id IN ('moments', 'avatars')
  AND auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "authenticated can upload app media" ON storage.objects;
CREATE POLICY "authenticated can upload app media"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id IN ('moments', 'avatars')
  AND auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "owners can update app media" ON storage.objects;
CREATE POLICY "owners can update app media"
ON storage.objects
FOR UPDATE
USING (
  bucket_id IN ('moments', 'avatars')
  AND owner = auth.uid()
)
WITH CHECK (
  bucket_id IN ('moments', 'avatars')
  AND owner = auth.uid()
);

DROP POLICY IF EXISTS "owners can delete app media" ON storage.objects;
CREATE POLICY "owners can delete app media"
ON storage.objects
FOR DELETE
USING (
  bucket_id IN ('moments', 'avatars')
  AND owner = auth.uid()
);

-- ── Performance / state consistency indexes ──────────────────────────

CREATE INDEX IF NOT EXISTS idx_trips_user_state
  ON public.trips (user_id, status, start_date)
  WHERE deleted_at IS NULL AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_group_members_user_trip
  ON public.group_members (user_id, trip_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_flights_trip_direction_departure
  ON public.flights (trip_id, direction, departure_time);

DO $$
BEGIN
  IF to_regclass('public.moments') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_moments_trip_taken ON public.moments (trip_id, taken_at DESC)';
  END IF;

  IF to_regclass('public.personal_photos') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_personal_photos_user_taken ON public.personal_photos (user_id, taken_at DESC)';
  END IF;

  IF to_regclass('public.stories') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_stories_expiry_created ON public.stories (expires_at, created_at DESC)';
  END IF;
END $$;
