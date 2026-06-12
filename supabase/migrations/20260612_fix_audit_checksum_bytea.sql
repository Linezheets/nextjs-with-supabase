-- ─────────────────────────────────────────────────────────────────────────────
-- Fix fn_audit_row_change() checksum: text::bytea → convert_to(text,'UTF8')
-- ─────────────────────────────────────────────────────────────────────────────
-- Bug: the SHA-256 checksum did `(... v_old_data::text ...)::bytea`. Casting TEXT
-- to BYTEA interprets backslash-escape sequences, so any row whose JSON snapshot
-- contains a quote/backslash (e.g. a product name with " or \) produced
-- "22P02 invalid input syntax for type bytea" and aborted the whole write — i.e.
-- the audit trigger silently broke UPDATE/INSERT/DELETE on audited tables whenever
-- the data had a quote. convert_to(text,'UTF8') returns the UTF-8 bytes directly,
-- with no escape parsing — the correct input for hashing.
--
-- Idempotent (CREATE OR REPLACE). Safe to re-run, safe on prod.
-- ─────────────────────────────────────────────────────────────────────────────

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
  v_changed_by := NULLIF(current_setting('app.user_id', true), '');
  IF v_changed_by IS NULL THEN
    BEGIN v_changed_by := auth.uid()::text;
    EXCEPTION WHEN OTHERS THEN v_changed_by := NULL; END;
  END IF;

  v_changed_by_role := NULLIF(current_setting('app.user_role', true), '');
  IF v_changed_by_role IS NULL THEN
    BEGIN
      v_changed_by_role := COALESCE(
        auth.jwt() -> 'user_metadata' ->> 'role',
        auth.jwt() -> 'app_metadata'  ->> 'role'
      );
    EXCEPTION WHEN OTHERS THEN v_changed_by_role := NULL; END;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_new_data := to_jsonb(NEW);
    v_old_data := NULL;
    IF v_changed_by IS NULL THEN
      v_changed_by := COALESCE(v_new_data->>'buyer_id', v_new_data->>'user_id',
                               v_new_data->>'created_by', current_user);
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
    SELECT array_agg(key ORDER BY key) INTO v_changed_fields
    FROM (
      SELECT key FROM jsonb_each(v_old_data)
      WHERE key NOT IN ('updated_at')
        AND (v_old_data->key) IS DISTINCT FROM (v_new_data->key)
    ) diff;
    IF v_changed_fields IS NULL OR array_length(v_changed_fields, 1) = 0 THEN
      RETURN NEW;
    END IF;
    IF v_changed_by IS NULL THEN
      v_changed_by := COALESCE(v_new_data->>'buyer_id', v_new_data->>'user_id', current_user);
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := NULL;
    IF v_changed_by IS NULL THEN
      v_changed_by := COALESCE(v_old_data->>'buyer_id', v_old_data->>'user_id', current_user);
    END IF;
  END IF;

  v_row_id := COALESCE(
    CASE WHEN TG_OP = 'DELETE' THEN v_old_data->>'id' ELSE v_new_data->>'id' END,
    CASE WHEN TG_OP = 'DELETE' THEN v_old_data->>'order_id' ELSE v_new_data->>'order_id' END,
    CASE WHEN TG_OP = 'DELETE' THEN v_old_data->>'buyer_id' ELSE v_new_data->>'buyer_id' END
  );

  -- THE FIX: convert_to(...,'UTF8') instead of (...)::bytea
  v_checksum := encode(
    sha256(convert_to(
      TG_TABLE_NAME || TG_OP ||
      COALESCE(v_old_data::text, 'null') ||
      COALESCE(v_new_data::text, 'null') ||
      NOW()::text,
      'UTF8'
    )),
    'hex'
  );

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
