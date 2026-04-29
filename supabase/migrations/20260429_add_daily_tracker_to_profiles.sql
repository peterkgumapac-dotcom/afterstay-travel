-- Add daily tracker toggle to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS daily_tracker_enabled boolean DEFAULT false;
