-- Per-member expense split assignments for group trips
-- Tracks who owes what on each expense, with settlement status

CREATE TABLE IF NOT EXISTS expense_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES group_members(id) ON DELETE CASCADE,
  member_name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  settled boolean DEFAULT false,
  settled_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_expense_splits_expense ON expense_splits(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_splits_trip ON expense_splits(trip_id);
CREATE INDEX IF NOT EXISTS idx_expense_splits_member ON expense_splits(member_id);

-- RLS
ALTER TABLE expense_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trip members can read splits"
  ON expense_splits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.trip_id = expense_splits.trip_id
        AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "trip members can create splits"
  ON expense_splits FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.trip_id = expense_splits.trip_id
        AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "trip members can update splits"
  ON expense_splits FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.trip_id = expense_splits.trip_id
        AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "trip members can delete splits"
  ON expense_splits FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.trip_id = expense_splits.trip_id
        AND group_members.user_id = auth.uid()
    )
  );

-- User-scoped payment QR codes (not trip-specific)
CREATE TABLE IF NOT EXISTS user_payment_qrs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  uri text NOT NULL,
  qr_data text,
  bank text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_payment_qrs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users own their payment qrs"
  ON user_payment_qrs FOR ALL
  USING (user_id = auth.uid());
