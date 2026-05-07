-- Fix: allow visibility='public' in moments update CHECK so
-- publishMomentToExplore can flip a moment to Explore-feed visibility.
-- Prior policy (20260502_moments_upload_write_policies.sql) only allowed
-- shared/private/album, causing publishMomentToExplore to silently no-op.

DROP POLICY IF EXISTS "moments_update" ON public.moments;
CREATE POLICY "moments_update" ON public.moments
FOR UPDATE
USING (
  auth.uid() IS NOT NULL
  AND user_id = auth.uid()
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND user_id = auth.uid()
  AND COALESCE(visibility, 'shared') IN ('shared', 'private', 'album', 'public')
);
