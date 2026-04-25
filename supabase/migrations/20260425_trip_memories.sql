-- Add premium tier to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'free'
CHECK (tier IN ('free', 'premium'));

-- Trip memories — AI-generated keepsake saved at trip completion
CREATE TABLE IF NOT EXISTS trip_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),

  -- AI-generated content (immutable once saved)
  narrative text NOT NULL,
  day_highlights jsonb NOT NULL DEFAULT '[]',
  stats_card jsonb NOT NULL DEFAULT '{}',
  vibe_analysis jsonb NOT NULL DEFAULT '{}',

  -- Trip snapshot frozen at save time
  trip_snapshot jsonb NOT NULL DEFAULT '{}',
  expense_summary jsonb NOT NULL DEFAULT '{}',
  places_summary jsonb NOT NULL DEFAULT '[]',
  flight_summary jsonb NOT NULL DEFAULT '[]',

  -- Photo references (not duplicated — fetched from moments table)
  hero_moment_id uuid REFERENCES moments(id) ON DELETE SET NULL,
  featured_moment_ids uuid[] DEFAULT '{}',

  -- Lifecycle
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'saved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  saved_at timestamptz,

  UNIQUE(trip_id, user_id)
);

-- RLS
ALTER TABLE trip_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own memories"
  ON trip_memories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own memories"
  ON trip_memories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own draft memories"
  ON trip_memories FOR UPDATE
  USING (auth.uid() = user_id AND status = 'draft');
