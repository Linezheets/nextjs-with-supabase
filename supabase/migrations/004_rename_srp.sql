-- ─────────────────────────────────────────────────────────────────────────────
-- Linezheets — rename retail_srp → srp + drop orphaned wholesale_usd column
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Rename retail_srp → srp
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory' AND column_name = 'retail_srp'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory' AND column_name = 'srp'
  ) THEN
    ALTER TABLE public.inventory RENAME COLUMN retail_srp TO srp;
    RAISE NOTICE 'Renamed retail_srp → srp';
  ELSE
    RAISE NOTICE 'retail_srp rename skipped (already renamed or column missing)';
  END IF;
END $$;

-- 2. Rename srp_usd → srp (handles databases that never ran migration 003)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory' AND column_name = 'srp_usd'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory' AND column_name = 'srp'
  ) THEN
    ALTER TABLE public.inventory RENAME COLUMN srp_usd TO srp;
    RAISE NOTICE 'Renamed srp_usd → srp';
  ELSE
    RAISE NOTICE 'srp_usd rename skipped';
  END IF;
END $$;

-- 3. Drop orphaned wholesale_usd column (duplicate of wsp_usd, never used by server)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory' AND column_name = 'wholesale_usd'
  ) THEN
    ALTER TABLE public.inventory DROP COLUMN wholesale_usd;
    RAISE NOTICE 'Dropped orphaned column wholesale_usd';
  ELSE
    RAISE NOTICE 'wholesale_usd column not found — already dropped or never existed';
  END IF;
END $$;

-- 4. Ensure srp column exists (idempotent — for fresh installs skipping older migrations)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory' AND column_name = 'srp'
  ) THEN
    ALTER TABLE public.inventory ADD COLUMN srp NUMERIC(10,2) NOT NULL DEFAULT 0;
    RAISE NOTICE 'Added srp column';
  END IF;
END $$;

-- 5. Verify final column list
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'inventory'
ORDER BY ordinal_position;
