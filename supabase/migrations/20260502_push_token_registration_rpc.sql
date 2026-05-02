-- Push token registration must create the profile row when auth/profile setup
-- races on brand-new accounts. Safe to run repeatedly.

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
