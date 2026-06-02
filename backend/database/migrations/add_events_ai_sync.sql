-- ── AI Sync columns for showroom_events ──────────────────────────────────────
-- Run in Supabase SQL Editor

ALTER TABLE showroom_events
  ADD COLUMN IF NOT EXISTS source_name   TEXT,
  ADD COLUMN IF NOT EXISTS source_url    TEXT,
  ADD COLUMN IF NOT EXISTS external_id   TEXT,
  ADD COLUMN IF NOT EXISTS ai_synced     BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- Unique constraint to prevent duplicate AI-sourced events
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_external_id
  ON showroom_events(external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_ai_synced
  ON showroom_events(ai_synced)
  WHERE ai_synced = true;

-- Allow service role to insert/update AI-synced events (bypasses RLS)
-- This is handled automatically by the service_role key in the sync script.

-- Sync log table
CREATE TABLE IF NOT EXISTS event_sync_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name  TEXT NOT NULL,
  source_url   TEXT,
  run_at       TIMESTAMPTZ DEFAULT NOW(),
  events_found INTEGER DEFAULT 0,
  events_added INTEGER DEFAULT 0,
  events_updated INTEGER DEFAULT 0,
  error_msg    TEXT,
  duration_ms  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_sync_log_run_at ON event_sync_log(run_at DESC);
