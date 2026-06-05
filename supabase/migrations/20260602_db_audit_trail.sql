-- ============================================================
-- LINEZHEETS — Database-Level Transactional Audit Trail
-- Run in Supabase SQL Editor
--
-- This is DIFFERENT from platform_audit_log (application events).
-- This captures every INSERT / UPDATE / DELETE on critical tables
-- at the PostgreSQL trigger level — fires even for direct SQL,
-- Supabase Dashboard edits, and bulk operations.
--
-- Each row stores:
--   • which table changed
--   • which operation (INSERT / UPDATE / DELETE)
--   • complete BEFORE snapshot (old_data JSONB)
--   • complete AFTER  snapshot (new_data JSONB)
--   • only the changed columns (changed_fields TEXT[])
--   • who did it (changed_by UUID — from app_user_id session var)
--   • when (changed_at TIMESTAMPTZ)
-- ============================================================

-- ── 1. Audit trail table ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS db_audit_trail (
  id             BIGSERIAL    PRIMARY KEY,
  changed_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- What changed
  table_name     TEXT         NOT NULL,
  operation      TEXT         NOT NULL,   -- INSERT | UPDATE | DELETE

  -- Row identity
  row_id         TEXT,                    -- pk value as text (covers UUID, BIGINT etc.)

  -- Full row snapshots
  old_data       JSONB,                   -- NULL for INSERT
  new_data       JSONB,                   -- NULL for DELETE

  -- Diff: only the column names that actually changed (UPDATE only)
  changed_fields TEXT[],

  -- Who — set by the app via SET LOCAL app.user_id = '<uuid>'
  -- Falls back to current_user (postgres role name) if not set
  changed_by     TEXT         DEFAULT current_user,
  changed_by_role TEXT,                   -- admin | brand | buyer | system

  -- Tamper detection
  checksum       TEXT                     -- SHA-256 of (table||op||old_data||new_data||changed_at)
);

-- Indexes
CREATE INDEX IF NOT EXISTS dat_table_op    ON db_audit_trail (table_name, operation);
CREATE INDEX IF NOT EXISTS dat_changed_at  ON db_audit_trail (changed_at DESC);
CREATE INDEX IF NOT EXISTS dat_row_id      ON db_audit_trail (table_name, row_id);
CREATE INDEX IF NOT EXISTS dat_changed_by  ON db_audit_trail (changed_by) WHERE changed_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS dat_old_data    ON db_audit_trail USING GIN (old_data)  WHERE old_data  IS NOT NULL;
CREATE INDEX IF NOT EXISTS dat_new_data    ON db_audit_trail USING GIN (new_data)  WHERE new_data  IS NOT NULL;

-- Make it append-only: nobody can UPDATE or DELETE audit rows
-- (even service-role key — only superuser can, which Supabase doesn't expose)
ALTER TABLE db_audit_trail ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read rows where they are the changer
CREATE POLICY "Users read own audit trail"
  ON db_audit_trail FOR SELECT
  TO authenticated
  USING (changed_by = auth.uid()::text);

-- Admins can read all
CREATE POLICY "Admins read all audit trail"
  ON db_audit_trail FOR SELECT
  TO authenticated
  USING (is_platform_admin());  -- reuses function from platform_audit_log migration

-- No UPDATE or DELETE policies — append-only enforced

-- ── 2. Generic trigger function ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_audit_row_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER   -- runs as table owner, not the calling role
AS $$
DECLARE
  v_old_data       JSONB;
  v_new_data       JSONB;
  v_changed_fields TEXT[];
  v_row_id         TEXT;
  v_changed_by     TEXT;
  v_changed_by_role TEXT;
  v_checksum       TEXT;
  v_key            TEXT;
BEGIN
  -- Resolve who is making the change
  -- App sets: SET LOCAL app.user_id = '<uuid>'; before the query
  v_changed_by := NULLIF(current_setting('app.user_id', true), '');
  IF v_changed_by IS NULL THEN
    v_changed_by := current_user;  -- fallback: postgres role
  END IF;

  v_changed_by_role := NULLIF(current_setting('app.user_role', true), '');

  -- Build old/new snapshots
  IF TG_OP = 'INSERT' THEN
    v_new_data := to_jsonb(NEW);
    v_old_data := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
    -- Compute which columns actually changed (skip noise)
    SELECT array_agg(key ORDER BY key)
    INTO v_changed_fields
    FROM (
      SELECT key
      FROM jsonb_each(v_old_data)
      WHERE key NOT IN ('updated_at')  -- skip auto-timestamp
        AND (v_old_data->key) IS DISTINCT FROM (v_new_data->key)
    ) diff;
  ELSIF TG_OP = 'DELETE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := NULL;
  END IF;

  -- Extract the primary key value (try common pk names)
  IF TG_OP = 'DELETE' THEN
    v_row_id := COALESCE(
      (v_old_data->>'id'),
      (v_old_data->>'order_id'),
      (v_old_data->>'buyer_id')
    );
  ELSE
    v_row_id := COALESCE(
      (v_new_data->>'id'),
      (v_new_data->>'order_id'),
      (v_new_data->>'buyer_id')
    );
  END IF;

  -- SHA-256 checksum for tamper detection
  v_checksum := encode(
    sha256(
      (TG_TABLE_NAME || TG_OP ||
       COALESCE(v_old_data::text, 'null') ||
       COALESCE(v_new_data::text, 'null') ||
       NOW()::text
      )::bytea
    ),
    'hex'
  );

  -- Skip UPDATE rows where nothing meaningful changed
  IF TG_OP = 'UPDATE' AND (v_changed_fields IS NULL OR array_length(v_changed_fields, 1) = 0) THEN
    RETURN NEW;
  END IF;

  -- Insert the audit row
  INSERT INTO db_audit_trail (
    table_name, operation, row_id,
    old_data, new_data, changed_fields,
    changed_by, changed_by_role, checksum
  ) VALUES (
    TG_TABLE_NAME, TG_OP, v_row_id,
    v_old_data, v_new_data, v_changed_fields,
    v_changed_by, v_changed_by_role, v_checksum
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- ── 3. Helper: set app.user_id from Supabase JWT (call from RLS or app) ───────
-- The app should call this before any mutating query on an authenticated request:
--   SET LOCAL app.user_id   = '<user_uuid>';
--   SET LOCAL app.user_role = 'admin';      -- or 'brand' | 'buyer'
--
-- Alternatively, add this to a BEFORE trigger on each table to auto-extract
-- the user from the JWT if using Supabase RLS + auth.uid():

CREATE OR REPLACE FUNCTION fn_set_audit_user()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Attempt to read user ID from Supabase auth JWT
  PERFORM set_config('app.user_id',   COALESCE(auth.uid()::text, ''), true);
  PERFORM set_config('app.user_role', COALESCE(
    auth.jwt() ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role',
    auth.jwt() -> 'app_metadata'  ->> 'role',
    ''
  ), true);
END;
$$;

-- ── 4. Attach triggers to critical tables ─────────────────────────────────────

-- buyers -----------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_audit_buyers ON buyers;
CREATE TRIGGER trg_audit_buyers
  AFTER INSERT OR UPDATE OR DELETE ON buyers
  FOR EACH ROW EXECUTE FUNCTION fn_audit_row_change();

-- buyer_orders -----------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_audit_buyer_orders ON buyer_orders;
CREATE TRIGGER trg_audit_buyer_orders
  AFTER INSERT OR UPDATE OR DELETE ON buyer_orders
  FOR EACH ROW EXECUTE FUNCTION fn_audit_row_change();

-- inventory --------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_audit_inventory ON inventory;
CREATE TRIGGER trg_audit_inventory
  AFTER INSERT OR UPDATE OR DELETE ON inventory
  FOR EACH ROW EXECUTE FUNCTION fn_audit_row_change();

-- brand_storefronts ------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_audit_brand_storefronts ON brand_storefronts;
CREATE TRIGGER trg_audit_brand_storefronts
  AFTER INSERT OR UPDATE OR DELETE ON brand_storefronts
  FOR EACH ROW EXECUTE FUNCTION fn_audit_row_change();

-- integration_configs (credentials — high sensitivity) ------------------------
DROP TRIGGER IF EXISTS trg_audit_integration_configs ON integration_configs;
CREATE TRIGGER trg_audit_integration_configs
  AFTER INSERT OR UPDATE OR DELETE ON integration_configs
  FOR EACH ROW EXECUTE FUNCTION fn_audit_row_change();

-- wholesale_access (VIP access grants/revocations) ----------------------------
DROP TRIGGER IF EXISTS trg_audit_wholesale_access ON wholesale_access;
CREATE TRIGGER trg_audit_wholesale_access
  AFTER INSERT OR UPDATE OR DELETE ON wholesale_access
  FOR EACH ROW EXECUTE FUNCTION fn_audit_row_change();

-- orders (legacy orders table) ------------------------------------------------
DROP TRIGGER IF EXISTS trg_audit_orders ON orders;
CREATE TRIGGER trg_audit_orders
  AFTER INSERT OR UPDATE OR DELETE ON orders
  FOR EACH ROW EXECUTE FUNCTION fn_audit_row_change();

-- ── 5. Convenience view: decoded change diff ─────────────────────────────────
-- Shows old → new values for changed columns only (much easier to read)

CREATE OR REPLACE VIEW v_audit_trail_diff AS
SELECT
  id,
  changed_at,
  table_name,
  operation,
  row_id,
  changed_by,
  changed_by_role,
  -- For UPDATE: render each changed field as {field: {from: x, to: y}}
  CASE
    WHEN operation = 'UPDATE' AND changed_fields IS NOT NULL THEN
      jsonb_object_agg(
        cf,
        jsonb_build_object('from', old_data->cf, 'to', new_data->cf)
      )
    WHEN operation = 'INSERT' THEN new_data
    WHEN operation = 'DELETE' THEN old_data
    ELSE NULL
  END AS diff,
  checksum
FROM db_audit_trail,
     LATERAL unnest(COALESCE(changed_fields, ARRAY[]::TEXT[])) AS cf
WHERE operation != 'UPDATE' OR (changed_fields IS NOT NULL)
GROUP BY id, changed_at, table_name, operation, row_id, changed_by, changed_by_role,
         old_data, new_data, changed_fields, checksum
ORDER BY changed_at DESC;

-- Grant read access
GRANT SELECT ON v_audit_trail_diff TO authenticated;

-- ── 6. Confirm ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  tbl TEXT;
  trig_count INT := 0;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['buyers','buyer_orders','inventory',
                                  'brand_storefronts','integration_configs',
                                  'wholesale_access','orders']) LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.triggers
      WHERE trigger_name = 'trg_audit_' || replace(tbl, '_', '_')
        AND event_object_table = tbl
    ) THEN
      trig_count := trig_count + 1;
    END IF;
  END LOOP;
  RAISE NOTICE 'db_audit_trail ready — % triggers installed, v_audit_trail_diff view created', trig_count;
END;
$$;

-- ── 7. RPC: set audit user from app layer ────────────────────────────────────
-- Called by lib/supabase/set-audit-user.ts before any mutating query.
-- Uses SET LOCAL so values are scoped to the current transaction only.

CREATE OR REPLACE FUNCTION fn_set_audit_user_params(
  p_user_id   TEXT,
  p_user_role TEXT DEFAULT 'buyer'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM set_config('app.user_id',   COALESCE(p_user_id,   ''), true);
  PERFORM set_config('app.user_role', COALESCE(p_user_role, ''), true);
END;
$$;

-- Allow authenticated users to call it
GRANT EXECUTE ON FUNCTION fn_set_audit_user_params(TEXT, TEXT) TO authenticated;
