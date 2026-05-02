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
