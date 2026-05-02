-- Moments upload write policies
-- Fixes photo uploads that reach Storage but fail when inserting the moments row,
-- especially for invited trip members. Also hardens the public Explore feed
-- upload chain used by app/add-moment.tsx.

INSERT INTO storage.buckets (id, name, public)
VALUES ('moments', 'moments', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "moments_storage_authenticated_read" ON storage.objects;
CREATE POLICY "moments_storage_authenticated_read" ON storage.objects
FOR SELECT
USING (
  bucket_id = 'moments'
  AND auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "moments_storage_authenticated_upload" ON storage.objects;
CREATE POLICY "moments_storage_authenticated_upload" ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'moments'
  AND auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "moments_storage_owner_update" ON storage.objects;
CREATE POLICY "moments_storage_owner_update" ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'moments'
  AND owner = auth.uid()
)
WITH CHECK (
  bucket_id = 'moments'
  AND owner = auth.uid()
);

DROP POLICY IF EXISTS "moments_storage_owner_delete" ON storage.objects;
CREATE POLICY "moments_storage_owner_delete" ON storage.objects
FOR DELETE
USING (
  bucket_id = 'moments'
  AND owner = auth.uid()
);

ALTER TABLE IF EXISTS public.moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.personal_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "moments_insert" ON public.moments;
CREATE POLICY "moments_insert" ON public.moments
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND user_id = auth.uid()
  AND (
    public.is_trip_owner(trip_id, auth.uid())
    OR public.is_trip_member(trip_id, auth.uid())
  )
  AND COALESCE(visibility, 'shared') IN ('shared', 'private', 'album')
);

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
  AND COALESCE(visibility, 'shared') IN ('shared', 'private', 'album')
);

DROP POLICY IF EXISTS "moments_delete" ON public.moments;
CREATE POLICY "moments_delete" ON public.moments
FOR DELETE
USING (
  auth.uid() IS NOT NULL
  AND user_id = auth.uid()
);

DROP POLICY IF EXISTS "personal_photos_insert" ON public.personal_photos;
CREATE POLICY "personal_photos_insert" ON public.personal_photos
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND user_id = auth.uid()
);

DROP POLICY IF EXISTS "personal_photos_select" ON public.personal_photos;
CREATE POLICY "personal_photos_select" ON public.personal_photos
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND user_id = auth.uid()
);

DROP POLICY IF EXISTS "personal_photos_update" ON public.personal_photos;
CREATE POLICY "personal_photos_update" ON public.personal_photos
FOR UPDATE
USING (
  auth.uid() IS NOT NULL
  AND user_id = auth.uid()
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND user_id = auth.uid()
);

DROP POLICY IF EXISTS "personal_photos_delete" ON public.personal_photos;
CREATE POLICY "personal_photos_delete" ON public.personal_photos
FOR DELETE
USING (
  auth.uid() IS NOT NULL
  AND user_id = auth.uid()
);

DO $$
BEGIN
  IF to_regclass('public.feed_posts') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "users create own" ON public.feed_posts';
    EXECUTE 'CREATE POLICY "users create own" ON public.feed_posts FOR INSERT WITH CHECK (user_id = auth.uid())';
    EXECUTE 'DROP POLICY IF EXISTS "users update own" ON public.feed_posts';
    EXECUTE 'CREATE POLICY "users update own" ON public.feed_posts FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())';
    EXECUTE 'DROP POLICY IF EXISTS "users delete own" ON public.feed_posts';
    EXECUTE 'CREATE POLICY "users delete own" ON public.feed_posts FOR DELETE USING (user_id = auth.uid())';
  END IF;

  IF to_regclass('public.post_media') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.post_media ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "owner inserts media" ON public.post_media';
    EXECUTE 'CREATE POLICY "owner inserts media" ON public.post_media FOR INSERT WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.feed_posts
        WHERE feed_posts.id = post_media.post_id
          AND feed_posts.user_id = auth.uid()
      )
    )';
    EXECUTE 'DROP POLICY IF EXISTS "owner deletes media" ON public.post_media';
    EXECUTE 'CREATE POLICY "owner deletes media" ON public.post_media FOR DELETE USING (
      EXISTS (
        SELECT 1 FROM public.feed_posts
        WHERE feed_posts.id = post_media.post_id
          AND feed_posts.user_id = auth.uid()
      )
    )';
  END IF;
END $$;
