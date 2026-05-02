-- Media storage stabilization
-- - Private trip-files bucket for Essentials documents
-- - Trip member RLS for trip_files metadata
-- - Storage policies scoped by object path: trip-files/{tripId}/{userId}/{file}

INSERT INTO storage.buckets (id, name, public)
VALUES ('trip-files', 'trip-files', false)
ON CONFLICT (id) DO UPDATE SET public = false;

ALTER TABLE IF EXISTS public.trip_files
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS content_type text,
  ADD COLUMN IF NOT EXISTS size_bytes bigint,
  ADD COLUMN IF NOT EXISTS uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.trip_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trip_files_select" ON public.trip_files;
CREATE POLICY "trip_files_select" ON public.trip_files
FOR SELECT
USING (
  public.is_trip_owner(trip_id, auth.uid())
  OR public.is_trip_member(trip_id, auth.uid())
);

DROP POLICY IF EXISTS "trip_files_insert" ON public.trip_files;
CREATE POLICY "trip_files_insert" ON public.trip_files
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    public.is_trip_owner(trip_id, auth.uid())
    OR public.is_trip_member(trip_id, auth.uid())
  )
  AND COALESCE(uploaded_by, auth.uid()) = auth.uid()
);

DROP POLICY IF EXISTS "trip_files_update" ON public.trip_files;
CREATE POLICY "trip_files_update" ON public.trip_files
FOR UPDATE
USING (
  public.is_trip_owner(trip_id, auth.uid())
  OR public.is_trip_member(trip_id, auth.uid())
)
WITH CHECK (
  public.is_trip_owner(trip_id, auth.uid())
  OR public.is_trip_member(trip_id, auth.uid())
);

DROP POLICY IF EXISTS "trip_files_delete" ON public.trip_files;
CREATE POLICY "trip_files_delete" ON public.trip_files
FOR DELETE
USING (
  public.is_trip_owner(trip_id, auth.uid())
  OR uploaded_by = auth.uid()
);

DROP POLICY IF EXISTS "trip_files_storage_select" ON storage.objects;
CREATE POLICY "trip_files_storage_select" ON storage.objects
FOR SELECT
USING (
  bucket_id = 'trip-files'
  AND auth.uid() IS NOT NULL
  AND CASE
    WHEN (storage.foldername(name))[1] = 'trip-files'
      AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN (
      public.is_trip_owner(((storage.foldername(name))[2])::uuid, auth.uid())
      OR public.is_trip_member(((storage.foldername(name))[2])::uuid, auth.uid())
    )
    ELSE false
  END
);

DROP POLICY IF EXISTS "trip_files_storage_insert" ON storage.objects;
CREATE POLICY "trip_files_storage_insert" ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'trip-files'
  AND auth.uid() IS NOT NULL
  AND CASE
    WHEN (storage.foldername(name))[1] = 'trip-files'
      AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN (
      public.is_trip_owner(((storage.foldername(name))[2])::uuid, auth.uid())
      OR public.is_trip_member(((storage.foldername(name))[2])::uuid, auth.uid())
    )
    ELSE false
  END
);

DROP POLICY IF EXISTS "trip_files_storage_update" ON storage.objects;
CREATE POLICY "trip_files_storage_update" ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'trip-files'
  AND owner = auth.uid()
)
WITH CHECK (
  bucket_id = 'trip-files'
  AND owner = auth.uid()
);

DROP POLICY IF EXISTS "trip_files_storage_delete" ON storage.objects;
CREATE POLICY "trip_files_storage_delete" ON storage.objects
FOR DELETE
USING (
  bucket_id = 'trip-files'
  AND owner = auth.uid()
);

CREATE INDEX IF NOT EXISTS idx_trip_files_trip_id ON public.trip_files(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_files_uploaded_by ON public.trip_files(uploaded_by);
