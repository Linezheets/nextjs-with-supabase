-- ============================================================
-- LINEZHEETS — Platform Audit Log
-- Run in Supabase SQL Editor
-- ============================================================

-- ── Table ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS platform_audit_log (
  id            BIGSERIAL PRIMARY KEY,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- ── Who ────────────────────────────────────────────────────────────────────
  user_id       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  email         TEXT,
  role          TEXT        NOT NULL,  -- admin | brand | buyer | anonymous | system

  -- ── What ───────────────────────────────────────────────────────────────────
  action        TEXT        NOT NULL,  -- see AuditAction enum in lib/audit.ts
  resource      TEXT,                  -- e.g. 'buyer:uuid', 'order:LZ-xxx'
  status        TEXT        NOT NULL,  -- success | failure | blocked | error
  detail        TEXT,                  -- human-readable one-liner
  metadata      JSONB,                 -- structured extra data

  -- ── Network ────────────────────────────────────────────────────────────────
  ip            INET,
  user_agent    TEXT,

  -- ── Geo (ip-api.com primary · ipinfo.io fallback) ─────────────────────────
  country       TEXT,
  city          TEXT,
  region        TEXT,
  org           TEXT,       -- "AS15169 Google LLC" style (ASN + ISP)
  timezone      TEXT,       -- e.g. "Asia/Hong_Kong"
  lat           DOUBLE PRECISION,
  lon           DOUBLE PRECISION,

  -- ── Device (from bowser) ───────────────────────────────────────────────────
  browser       TEXT,       -- Chrome | Firefox | Safari | Edge | Opera | Other
  browser_ver   TEXT,       -- e.g. "120.0.0.0"
  os            TEXT,       -- macOS | Windows | Linux | Android | iOS
  os_ver        TEXT,       -- e.g. "10.15.7"
  device_type   TEXT,       -- desktop | mobile | tablet
  device_vend   TEXT,       -- Apple | Samsung | Google etc.

  -- ── Privileged session ─────────────────────────────────────────────────────
  priv_role     TEXT,       -- admin | brand | NULL for regular buyers
  session_age_s INTEGER     -- seconds since priv-session was stamped at login
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- Time-based range scans (most common query pattern)
CREATE INDEX IF NOT EXISTS pal_created_at   ON platform_audit_log (created_at DESC);
-- Filter by user
CREATE INDEX IF NOT EXISTS pal_user_id      ON platform_audit_log (user_id)
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS pal_email        ON platform_audit_log (email)
  WHERE email IS NOT NULL;
-- Filter by role + action (admin dashboards)
CREATE INDEX IF NOT EXISTS pal_role_action  ON platform_audit_log (role, action);
-- Filter by IP (security investigations)
CREATE INDEX IF NOT EXISTS pal_ip           ON platform_audit_log (ip)
  WHERE ip IS NOT NULL;
-- Filter by action + status (alerting on failures/blocks)
CREATE INDEX IF NOT EXISTS pal_action_status ON platform_audit_log (action, status);
-- GIN on metadata for flexible JSON queries
CREATE INDEX IF NOT EXISTS pal_metadata     ON platform_audit_log USING GIN (metadata)
  WHERE metadata IS NOT NULL;

-- ── Row-Level Security ────────────────────────────────────────────────────────

ALTER TABLE platform_audit_log ENABLE ROW LEVEL SECURITY;

-- Application writes via service-role key (bypasses RLS) — no INSERT policy needed.
-- Authenticated users can only read their OWN rows.
CREATE POLICY "Users read own audit rows"
  ON platform_audit_log FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can read everything (enforced additionally in the API layer).
-- We use a function to avoid hardcoding emails in SQL.
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT (auth.jwt() ->> 'role') = 'admin'
      OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
      OR auth.email() IN ('hello@linezheets.com', 'info@mxlla.com');
$$;

CREATE POLICY "Admins read all audit rows"
  ON platform_audit_log FOR SELECT
  TO authenticated
  USING (is_platform_admin());

-- ── Retention: auto-delete rows older than 2 years ───────────────────────────
-- Run this as a scheduled job in Supabase → Database → Scheduled Jobs
-- (or via Vercel cron — see /api/cron/audit-cleanup)
-- DELETE FROM platform_audit_log WHERE created_at < NOW() - INTERVAL '2 years';

-- ── Confirm ───────────────────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE 'platform_audit_log table ready';
END;
$$;
