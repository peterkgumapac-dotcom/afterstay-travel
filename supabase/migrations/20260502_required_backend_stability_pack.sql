-- Required backend stability pack for the May 2 OTA batches.
-- Safe to run repeatedly in Supabase SQL Editor.
--
-- Covers:
-- 1. Brand-new user profile/handle and push-token races
-- 2. Firebase/Expo push token storage
-- 3. Public profile search/view RPCs
-- 4. Atomic scan-trip flight replacement using arrival_time
-- 5. Explore feed RPC hardening

-- Profiles / push columns
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

CREATE OR REPLACE FUNCTION public.save_own_push_tokens(
  p_fcm_token text DEFAULT NULL,
  p_expo_push_token text DEFAULT NULL,
  p_push_provider text DEFAULT 'firebase',
  p_push_enabled boolean DEFAULT true
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
    fcm_token,
    expo_push_token,
    push_provider,
    push_enabled
  )
  VALUES (
    v_uid,
    NULLIF(p_fcm_token, ''),
    NULLIF(p_expo_push_token, ''),
    COALESCE(NULLIF(p_push_provider, ''), 'firebase'),
    COALESCE(p_push_enabled, false)
  )
  ON CONFLICT (id) DO UPDATE SET
    fcm_token = NULLIF(p_fcm_token, ''),
    expo_push_token = NULLIF(p_expo_push_token, ''),
    push_provider = COALESCE(NULLIF(p_push_provider, ''), public.profiles.push_provider, 'firebase'),
    push_enabled = COALESCE(p_push_enabled, public.profiles.push_enabled, false),
    updated_at = now()
  RETURNING * INTO v_profile;

  RETURN v_profile;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_own_push_tokens(text, text, text, boolean) TO authenticated;

-- Public profile lookup used by Explore Moments and profile search.
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

-- Trip/group invite hardening. Invite codes are reusable group codes until
-- expiry; "used" is history, not an access gate.
ALTER TABLE IF EXISTS public.group_members
  ADD COLUMN IF NOT EXISTS shares_accommodation boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS travel_notes text;

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

-- Scan-trip flight replacement. This avoids PostgREST schema cache failures
-- around arrival_time/arrive_time during itinerary rescans.
ALTER TABLE IF EXISTS public.flights
  ADD COLUMN IF NOT EXISTS seat_number text;

CREATE OR REPLACE FUNCTION public.replace_trip_flights_from_scan(
  p_trip_id uuid,
  p_flights jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_count integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'replace_trip_flights_from_scan: not authenticated'
      USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.trips t
    WHERE t.id = p_trip_id
      AND t.user_id = v_user_id
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.trip_id = p_trip_id
      AND gm.user_id = v_user_id
      AND gm.role = 'Primary'
  ) THEN
    RAISE EXCEPTION 'replace_trip_flights_from_scan: not trip admin'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.flights
  WHERE trip_id = p_trip_id
    AND NULLIF(passenger, '') IS NULL;

  IF jsonb_typeof(COALESCE(p_flights, '[]'::jsonb)) <> 'array'
     OR jsonb_array_length(COALESCE(p_flights, '[]'::jsonb)) = 0 THEN
    RETURN 0;
  END IF;

  INSERT INTO public.flights (
    trip_id,
    direction,
    flight_number,
    airline,
    origin,
    destination,
    departure_time,
    arrival_time,
    confirmation,
    seat_number,
    passenger
  )
  SELECT
    p_trip_id,
    CASE
      WHEN lower(COALESCE(f->>'direction', '')) SIMILAR TO '%(return|inbound|arrival|arrive|back|homebound)%'
        THEN 'Return'
      ELSE 'Outbound'
    END,
    COALESCE(NULLIF(f->>'flightNumber', ''), NULLIF(f->>'flight_number', ''), 'Flight'),
    NULLIF(COALESCE(f->>'airline', ''), ''),
    NULLIF(COALESCE(f->>'fromCity', f->>'from', f->>'origin', ''), ''),
    NULLIF(COALESCE(f->>'toCity', f->>'to', f->>'destination', ''), ''),
    NULLIF(COALESCE(f->>'departTime', f->>'depart_time', f->>'departure_time', ''), '')::timestamptz,
    NULLIF(COALESCE(f->>'arriveTime', f->>'arrive_time', f->>'arrival_time', ''), '')::timestamptz,
    NULLIF(COALESCE(f->>'bookingRef', f->>'booking_ref', f->>'confirmation', ''), ''),
    NULLIF(COALESCE(f->>'seatNumber', f->>'seat_number', ''), ''),
    NULLIF(COALESCE(f->>'passenger', ''), '')
  FROM jsonb_array_elements(p_flights) AS f;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.replace_trip_flights_from_scan(uuid, jsonb) TO authenticated;

-- Explore feed RPC. Assumes feed_posts/post_media/feed_post_likes/post_saves
-- already exist from the Explore Moments migrations.
CREATE OR REPLACE FUNCTION public.get_explore_feed(
  p_mode text DEFAULT 'recent',
  p_location text DEFAULT NULL,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  user_name text,
  user_avatar text,
  type text,
  caption text,
  location_name text,
  latitude numeric,
  longitude numeric,
  layout_type text,
  photo_url text,
  metadata jsonb,
  created_at timestamptz,
  likes_count int,
  comments_count int,
  share_count int,
  save_count int,
  viewer_has_liked boolean,
  viewer_has_saved boolean,
  media jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  p_limit := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
  p_offset := GREATEST(COALESCE(p_offset, 0), 0);

  RETURN QUERY
  SELECT
    fp.id,
    fp.user_id,
    COALESCE(pr.full_name, 'Traveler')::text AS user_name,
    pr.avatar_url::text AS user_avatar,
    fp.type,
    fp.caption,
    fp.location_name,
    fp.latitude,
    fp.longitude,
    fp.layout_type,
    fp.photo_url,
    fp.metadata,
    fp.created_at,
    fp.likes_count,
    fp.comments_count,
    fp.share_count,
    fp.save_count,
    EXISTS (
      SELECT 1 FROM public.feed_post_likes fpl
      WHERE fpl.post_id = fp.id AND fpl.user_id = auth.uid()
    ) AS viewer_has_liked,
    EXISTS (
      SELECT 1 FROM public.post_saves ps
      WHERE ps.post_id = fp.id AND ps.user_id = auth.uid()
    ) AS viewer_has_saved,
    COALESCE(
      (
        SELECT jsonb_agg(jsonb_build_object(
          'id', pm.id,
          'mediaUrl', pm.media_url,
          'storagePath', pm.storage_path,
          'mediaType', pm.media_type,
          'width', pm.width,
          'height', pm.height,
          'orderIndex', pm.order_index
        ) ORDER BY pm.order_index)
        FROM public.post_media pm
        WHERE pm.post_id = fp.id
      ),
      '[]'::jsonb
    ) AS media
  FROM public.feed_posts fp
  LEFT JOIN public.profiles pr ON pr.id = fp.user_id
  WHERE fp.is_public = true
    AND (p_location IS NULL OR fp.location_name ILIKE '%' || p_location || '%')
  ORDER BY
    CASE WHEN p_mode = 'trending' THEN fp.likes_count + fp.comments_count + fp.share_count ELSE 0 END DESC,
    fp.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_explore_feed(text, text, int, int) TO authenticated;
