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
    socials = COALESCE(p_socials, public.profiles.socials)
  RETURNING * INTO v_profile;

  RETURN v_profile;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_own_profile(text, text, text, text, jsonb) TO authenticated;
