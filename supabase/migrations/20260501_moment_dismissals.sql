-- Per-user moment dismissals (hide from my view without affecting others)
CREATE TABLE IF NOT EXISTS moment_dismissals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  moment_id uuid NOT NULL REFERENCES moments(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, moment_id)
);

ALTER TABLE moment_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own dismissals"
  ON moment_dismissals FOR ALL
  USING (user_id = auth.uid());
