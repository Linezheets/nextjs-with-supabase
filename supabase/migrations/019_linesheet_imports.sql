-- Tracks async Excel/CSV import jobs

CREATE TABLE IF NOT EXISTS linesheet_imports (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_user_id UUID        NOT NULL,
  filename      TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'processing',  -- processing | done | failed
  rows_parsed   INT         DEFAULT 0,
  rows_created  INT         DEFAULT 0,
  rows_skipped  INT         DEFAULT 0,
  errors        JSONB       DEFAULT '[]',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_linesheet_imports_user ON linesheet_imports(brand_user_id);

ALTER TABLE linesheet_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand read own imports"
  ON linesheet_imports FOR SELECT
  USING (brand_user_id = auth.uid());
