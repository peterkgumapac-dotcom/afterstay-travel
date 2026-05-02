ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS fcm_token text,
  ADD COLUMN IF NOT EXISTS push_provider text DEFAULT 'firebase';
