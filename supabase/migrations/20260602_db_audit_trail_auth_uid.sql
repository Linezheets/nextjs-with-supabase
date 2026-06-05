-- ============================================================
-- LINEZHEETS — Upgrade fn_audit_row_change to auto-detect user
-- Run in Supabase SQL Editor
--
-- Problem: trigger showed "changed_by: postgres" because it
-- relied on SET LOCAL app.user_id which doesn't persist across
-- separate PostgREST HTTP requests.
--
-- Fix: read auth.uid() directly from the JWT session variable
-- (Supabase sets this automatically for every authenticated
-- request via the anon key + user JWT). Also extract user IDs
-- from the row data itself as a last resort for service-role
-- writes (admin routes, order placement, stock adjustments).
-- ============================================================

CREATE OR REPLACE FUNCTION fn_audit_row_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_data        JSONB;
  v_new_data        JSONB;
  v_changed_fields  TEXT[];
  v_row_id          TEXT;
  v_changed_by      TEXT;
  v_changed_by_role TEXT;
  v_checksum        TEXT;
BEGIN

  -- ── Who made this change ──────────────────────────────────────────────────
  -- Priority:
  --   1. app.user_id session var  (set by fn_set_audit_user_params RPC)
  --   2. auth.uid()               (auto-set by Supabase for anon-key + JWT requests)
  --   3. Row data buyer_id/user_id (service-role writes on behalf of a user)
  --   4. current_user             (postgres role — last resort for system ops)

  v_changed_by := NULLIF(current_setting('app.user_id', true), '');

  IF v_changed_by IS NULL THEN
    BEGIN
      v_changed_by := auth.uid()::text;
    EXCEPTION WHEN OTHERS THEN
      v_changed_by := NULL;
    END;
  END IF;

  -- Role resolution: session var → JWT metadata → null
  v_changed_by_role := NULLIF(current_setting('app.user_role', true), '');

  IF v_changed_by_role IS NULL THEN
    BEGIN
      v_changed_by_role := COALESCE(
        auth.jwt() -> 'user_metadata' ->> 'role',
        auth.jwt() -> 'app_metadata'  ->> 'role'
      );
    EXCEPTION WHEN OTHERS THEN
      v_changed_by_role := NULL;
    END;
  END IF;

  -- ── Build snapshots ───────────────────────────────────────────────────────

  IF TG_OP = 'INSERT' THEN
    v_new_data := to_jsonb(NEW);
    v_old_data := NULL;

    -- For INSERT: if still no user, try pulling from the new row itself
    IF v_changed_by IS NULL THEN
      v_changed_by := COALESCE(
        v_new_data->>'buyer_id',
        v_new_data->>'user_id',
        v_new_data->>'created_by',
        current_user
      );
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);

    -- Compute changed columns, ignoring updated_at noise
    SELECT array_agg(key ORDER BY key)
    INTO   v_changed_fields
    FROM (
      SELECT key
      FROM   jsonb_each(v_old_data)
      WHERE  key NOT IN ('updated_at')
        AND  (v_old_data->key) IS DISTINCT FROM (v_new_data->key)
    ) diff;

    -- Skip if nothing meaningful changed
    IF v_changed_fields IS NULL OR array_length(v_changed_fields, 1) = 0 THEN
      RETURN NEW;
    END IF;

    IF v_changed_by IS NULL THEN
      v_changed_by := COALESCE(
        v_new_data->>'buyer_id',
        v_new_data->>'user_id',
        current_user
      );
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := NULL;

    IF v_changed_by IS NULL THEN
      v_changed_by := COALESCE(
        v_old_data->>'buyer_id',
        v_old_data->>'user_id',
        current_user
      );
    END IF;
  END IF;

  -- ── Row identity ──────────────────────────────────────────────────────────

  v_row_id := COALESCE(
    CASE WHEN TG_OP = 'DELETE' THEN v_old_data->>'id' ELSE v_new_data->>'id' END,
    CASE WHEN TG_OP = 'DELETE' THEN v_old_data->>'order_id' ELSE v_new_data->>'order_id' END,
    CASE WHEN TG_OP = 'DELETE' THEN v_old_data->>'buyer_id' ELSE v_new_data->>'buyer_id' END
  );

  -- ── Checksum (SHA-256 tamper detection) ───────────────────────────────────

  v_checksum := encode(
    sha256((
      TG_TABLE_NAME || TG_OP ||
      COALESCE(v_old_data::text, 'null') ||
      COALESCE(v_new_data::text, 'null') ||
      NOW()::text
    )::bytea),
    'hex'
  );

  -- ── Write audit row ───────────────────────────────────────────────────────

  INSERT INTO db_audit_trail (
    table_name,    operation,    row_id,
    old_data,      new_data,     changed_fields,
    changed_by,    changed_by_role,             checksum
  ) VALUES (
    TG_TABLE_NAME, TG_OP,        v_row_id,
    v_old_data,    v_new_data,   v_changed_fields,
    v_changed_by,  v_changed_by_role,           v_checksum
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  RAISE NOTICE 'fn_audit_row_change upgraded — now reads auth.uid() from JWT automatically';
END;
$$;
