-- ============================================================
-- LINEZHEETS — Add geo columns to platform_audit_log
-- Run this in Supabase SQL Editor if the table already exists
-- (the original migration didn't include timezone/lat/lon)
-- ============================================================

ALTER TABLE platform_audit_log
  ADD COLUMN IF NOT EXISTS timezone TEXT,
  ADD COLUMN IF NOT EXISTS lat      DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lon      DOUBLE PRECISION;

-- Spatial index for proximity queries (e.g. "all logins within 50km of HK")
CREATE INDEX IF NOT EXISTS pal_geo_point
  ON platform_audit_log (lat, lon)
  WHERE lat IS NOT NULL AND lon IS NOT NULL;

DO $$
BEGIN
  RAISE NOTICE 'platform_audit_log geo columns added (timezone, lat, lon)';
END;
$$;
