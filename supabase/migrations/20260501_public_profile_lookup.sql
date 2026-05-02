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
