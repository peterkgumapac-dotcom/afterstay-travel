-- Missing tables and RLS policies for production readiness
-- Tables referenced in lib/supabase.ts but not yet created

-- ── Albums ──
CREATE TABLE IF NOT EXISTS albums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES trips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  cover_url text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS album_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id uuid NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text CHECK (role IN ('owner', 'member')) DEFAULT 'member',
  created_at timestamptz DEFAULT now(),
  UNIQUE (album_id, user_id)
);

CREATE TABLE IF NOT EXISTS album_moments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id uuid NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  moment_id uuid NOT NULL REFERENCES moments(id) ON DELETE CASCADE,
  added_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE (album_id, moment_id)
);

-- ── Savings ──
CREATE TABLE IF NOT EXISTS savings_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_id uuid REFERENCES trips(id) ON DELETE SET NULL,
  name text NOT NULL,
  target_amount numeric NOT NULL DEFAULT 0,
  currency text DEFAULT 'PHP',
  deadline date,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS savings_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  note text,
  created_at timestamptz DEFAULT now()
);

-- ── Social / engagement ──
CREATE TABLE IF NOT EXISTS moment_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  moment_id uuid NOT NULL REFERENCES moments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (moment_id, user_id)
);

CREATE TABLE IF NOT EXISTS moment_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  moment_id uuid NOT NULL REFERENCES moments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at timestamptz DEFAULT now(),
  UNIQUE (moment_id, user_id)
);

CREATE TABLE IF NOT EXISTS highlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  moment_id uuid REFERENCES moments(id) ON DELETE SET NULL,
  title text,
  description text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wishlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  destination text NOT NULL,
  country_code text,
  notes text,
  target_date date,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS personal_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text,
  public_url text,
  location text,
  caption text,
  taken_at date,
  tags text[],
  blurhash text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lifetime_stats (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_trips int DEFAULT 0,
  total_nights int DEFAULT 0,
  total_countries int DEFAULT 0,
  total_miles numeric DEFAULT 0,
  total_spent numeric DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  reply_to uuid REFERENCES chat_messages(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- ══════════════════════════════════════════════════════════
-- RLS POLICIES
-- ══════════════════════════════════════════════════════════

-- ── profiles ──
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- Allow trip members to read each other's profiles
CREATE POLICY "trip members can read peer profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm1
      JOIN group_members gm2 ON gm1.trip_id = gm2.trip_id
      WHERE gm1.user_id = auth.uid()
        AND gm2.user_id = profiles.id
    )
  );

-- ── chat_messages ──
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trip members can read chat"
  ON chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.trip_id = chat_messages.trip_id
        AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "trip members can send chat"
  ON chat_messages FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.trip_id = chat_messages.trip_id
        AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "users can delete own messages"
  ON chat_messages FOR DELETE
  USING (user_id = auth.uid());

-- ── albums ──
ALTER TABLE albums ENABLE ROW LEVEL SECURITY;

CREATE POLICY "album members can read"
  ON albums FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM album_members
      WHERE album_members.album_id = albums.id
        AND album_members.user_id = auth.uid()
    )
  );

CREATE POLICY "users can create albums"
  ON albums FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "album owner can update"
  ON albums FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "album owner can delete"
  ON albums FOR DELETE
  USING (user_id = auth.uid());

-- ── album_members ──
ALTER TABLE album_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "album members can read membership"
  ON album_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM albums
      WHERE albums.id = album_members.album_id
        AND albums.user_id = auth.uid()
    )
  );

CREATE POLICY "album owner can manage members"
  ON album_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM albums
      WHERE albums.id = album_members.album_id
        AND albums.user_id = auth.uid()
    )
  );

-- ── album_moments ──
ALTER TABLE album_moments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "album members can read album moments"
  ON album_moments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM album_members
      WHERE album_members.album_id = album_moments.album_id
        AND album_members.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM albums
      WHERE albums.id = album_moments.album_id
        AND albums.user_id = auth.uid()
    )
  );

CREATE POLICY "album members can add moments"
  ON album_moments FOR INSERT
  WITH CHECK (
    added_by = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM album_members
        WHERE album_members.album_id = album_moments.album_id
          AND album_members.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM albums
        WHERE albums.id = album_moments.album_id
          AND albums.user_id = auth.uid()
      )
    )
  );

-- ── savings_goals ──
ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users own their savings goals"
  ON savings_goals FOR ALL
  USING (user_id = auth.uid());

-- ── savings_entries ──
ALTER TABLE savings_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users own their savings entries"
  ON savings_entries FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM savings_goals
      WHERE savings_goals.id = savings_entries.goal_id
        AND savings_goals.user_id = auth.uid()
    )
  );

-- ── moment_favorites ──
ALTER TABLE moment_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users own their favorites"
  ON moment_favorites FOR ALL
  USING (user_id = auth.uid());

-- ── moment_views ──
ALTER TABLE moment_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users own their views"
  ON moment_views FOR ALL
  USING (user_id = auth.uid());

-- ── highlights ──
ALTER TABLE highlights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trip members can read highlights"
  ON highlights FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.trip_id = highlights.trip_id
        AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "users can manage own highlights"
  ON highlights FOR ALL
  USING (user_id = auth.uid());

-- ── wishlist ──
ALTER TABLE wishlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users own their wishlist"
  ON wishlist FOR ALL
  USING (user_id = auth.uid());

-- ── personal_photos ──
ALTER TABLE personal_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users own their personal photos"
  ON personal_photos FOR ALL
  USING (user_id = auth.uid());

-- ── lifetime_stats ──
ALTER TABLE lifetime_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users own their stats"
  ON lifetime_stats FOR ALL
  USING (user_id = auth.uid());
