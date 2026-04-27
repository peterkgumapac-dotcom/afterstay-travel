-- Quick Trips: lightweight single-occasion trip entities (dinners, outings, gatherings)

CREATE TABLE quick_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  place_name text NOT NULL,
  place_address text,
  google_place_id text,
  latitude numeric,
  longitude numeric,
  category text NOT NULL CHECK (category IN ('family','date','coffee','solo','food','activity','other')),
  occurred_at timestamptz NOT NULL,
  cover_photo_url text,
  photo_count int DEFAULT 0,
  companion_count int DEFAULT 0,
  total_spend_amount numeric DEFAULT 0,
  total_spend_currency text DEFAULT 'PHP',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE quick_trip_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quick_trip_id uuid NOT NULL REFERENCES quick_trips(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  ordinal int DEFAULT 0,
  exif_taken_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE quick_trip_companions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quick_trip_id uuid NOT NULL REFERENCES quick_trips(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  display_name text NOT NULL,
  avatar_url text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE quick_trip_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quick_trip_id uuid NOT NULL REFERENCES quick_trips(id) ON DELETE CASCADE,
  created_by_user_id uuid REFERENCES auth.users(id),
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'PHP',
  description text,
  paid_by_companion_id uuid REFERENCES quick_trip_companions(id),
  split_type text CHECK (split_type IN ('even','custom','record_only')),
  occurred_at timestamptz NOT NULL,
  receipt_photo_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE quick_trip_expense_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quick_trip_expense_id uuid NOT NULL REFERENCES quick_trip_expenses(id) ON DELETE CASCADE,
  companion_id uuid NOT NULL REFERENCES quick_trip_companions(id),
  amount_owed numeric NOT NULL,
  settled_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_qt_user ON quick_trips(created_by_user_id);
CREATE INDEX idx_qt_occurred ON quick_trips(occurred_at DESC);
CREATE INDEX idx_qt_photos_trip ON quick_trip_photos(quick_trip_id);
CREATE INDEX idx_qt_companions_trip ON quick_trip_companions(quick_trip_id);
CREATE INDEX idx_qt_expenses_trip ON quick_trip_expenses(quick_trip_id);

-- RLS
ALTER TABLE quick_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_trip_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_trip_companions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_trip_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_trip_expense_splits ENABLE ROW LEVEL SECURITY;

-- quick_trips
CREATE POLICY "qt_select" ON quick_trips FOR SELECT USING (
  created_by_user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM quick_trip_companions WHERE quick_trip_id = id AND user_id = auth.uid()
  )
);
CREATE POLICY "qt_insert" ON quick_trips FOR INSERT WITH CHECK (created_by_user_id = auth.uid());
CREATE POLICY "qt_update" ON quick_trips FOR UPDATE USING (created_by_user_id = auth.uid());
CREATE POLICY "qt_delete" ON quick_trips FOR DELETE USING (created_by_user_id = auth.uid());

-- photos
CREATE POLICY "qt_photos_select" ON quick_trip_photos FOR SELECT USING (
  EXISTS (SELECT 1 FROM quick_trips WHERE id = quick_trip_id AND (
    created_by_user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM quick_trip_companions WHERE quick_trip_id = quick_trip_photos.quick_trip_id AND user_id = auth.uid()
    )
  ))
);
CREATE POLICY "qt_photos_insert" ON quick_trip_photos FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM quick_trips WHERE id = quick_trip_id AND created_by_user_id = auth.uid())
);
CREATE POLICY "qt_photos_delete" ON quick_trip_photos FOR DELETE USING (
  EXISTS (SELECT 1 FROM quick_trips WHERE id = quick_trip_id AND created_by_user_id = auth.uid())
);

-- companions
CREATE POLICY "qt_companions_select" ON quick_trip_companions FOR SELECT USING (
  EXISTS (SELECT 1 FROM quick_trips WHERE id = quick_trip_id AND (
    created_by_user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM quick_trip_companions c2 WHERE c2.quick_trip_id = quick_trip_companions.quick_trip_id AND c2.user_id = auth.uid()
    )
  ))
);
CREATE POLICY "qt_companions_insert" ON quick_trip_companions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM quick_trips WHERE id = quick_trip_id AND created_by_user_id = auth.uid())
);
CREATE POLICY "qt_companions_delete" ON quick_trip_companions FOR DELETE USING (
  EXISTS (SELECT 1 FROM quick_trips WHERE id = quick_trip_id AND created_by_user_id = auth.uid())
);

-- expenses
CREATE POLICY "qt_expenses_select" ON quick_trip_expenses FOR SELECT USING (
  EXISTS (SELECT 1 FROM quick_trips WHERE id = quick_trip_id AND (
    created_by_user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM quick_trip_companions WHERE quick_trip_id = quick_trip_expenses.quick_trip_id AND user_id = auth.uid()
    )
  ))
);
CREATE POLICY "qt_expenses_insert" ON quick_trip_expenses FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM quick_trips WHERE id = quick_trip_id AND created_by_user_id = auth.uid())
);
CREATE POLICY "qt_expenses_update" ON quick_trip_expenses FOR UPDATE USING (
  EXISTS (SELECT 1 FROM quick_trips WHERE id = quick_trip_id AND created_by_user_id = auth.uid())
);
CREATE POLICY "qt_expenses_delete" ON quick_trip_expenses FOR DELETE USING (
  EXISTS (SELECT 1 FROM quick_trips WHERE id = quick_trip_id AND created_by_user_id = auth.uid())
);

-- expense splits
CREATE POLICY "qt_splits_select" ON quick_trip_expense_splits FOR SELECT USING (
  EXISTS (SELECT 1 FROM quick_trip_expenses e JOIN quick_trips t ON t.id = e.quick_trip_id
    WHERE e.id = quick_trip_expense_id AND (
      t.created_by_user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM quick_trip_companions WHERE quick_trip_id = t.id AND user_id = auth.uid()
      )
    ))
);
CREATE POLICY "qt_splits_insert" ON quick_trip_expense_splits FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM quick_trip_expenses e JOIN quick_trips t ON t.id = e.quick_trip_id
    WHERE e.id = quick_trip_expense_id AND t.created_by_user_id = auth.uid())
);
