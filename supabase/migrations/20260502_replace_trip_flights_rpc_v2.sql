-- Tighten itinerary rescan replacement.
-- Keeps companion-specific manually entered rows unless the incoming scan
-- includes the same passenger, while still replacing the primary scanned
-- itinerary atomically.

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

  DELETE FROM public.flights existing
  WHERE existing.trip_id = p_trip_id
    AND (
      NULLIF(existing.passenger, '') IS NULL
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(COALESCE(p_flights, '[]'::jsonb)) = 'array'
              THEN COALESCE(p_flights, '[]'::jsonb)
            ELSE '[]'::jsonb
          END
        ) AS incoming(f)
        WHERE NULLIF(COALESCE(incoming.f->>'passenger', ''), '') IS NOT NULL
          AND lower(NULLIF(existing.passenger, '')) = lower(NULLIF(COALESCE(incoming.f->>'passenger', ''), ''))
      )
    );

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
