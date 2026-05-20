-- ─────────────────────────────────────────────────────────────────────────────
-- Linezheets — 004 · Canonical column cleanup
-- Ensures a single authoritative name for every column, drops orphaned ones.
-- Safe to run multiple times (all operations are IF EXISTS / IF NOT EXISTS).
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Rename retail_srp → srp ───────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='inventory' AND column_name='retail_srp'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='inventory' AND column_name='srp'
  ) THEN
    ALTER TABLE public.inventory RENAME COLUMN retail_srp TO srp;
    RAISE NOTICE '✓ Renamed retail_srp → srp';
  ELSE
    RAISE NOTICE '— retail_srp rename skipped';
  END IF;
END $$;

-- ── 2. Rename srp_usd → srp (for DBs that skipped migration 003) ─────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='inventory' AND column_name='srp_usd'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='inventory' AND column_name='srp'
  ) THEN
    ALTER TABLE public.inventory RENAME COLUMN srp_usd TO srp;
    RAISE NOTICE '✓ Renamed srp_usd → srp';
  ELSE
    RAISE NOTICE '— srp_usd rename skipped';
  END IF;
END $$;

-- ── 3. Rename stock → stock_total (for DBs that skipped migration 003) ────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='inventory' AND column_name='stock'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='inventory' AND column_name='stock_total'
  ) THEN
    ALTER TABLE public.inventory RENAME COLUMN stock TO stock_total;
    RAISE NOTICE '✓ Renamed stock → stock_total';
  ELSE
    RAISE NOTICE '— stock rename skipped';
  END IF;
END $$;

-- ── 4. Drop orphaned wholesale_usd (duplicate of wsp_usd, never used) ─────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='inventory' AND column_name='wholesale_usd'
  ) THEN
    ALTER TABLE public.inventory DROP COLUMN wholesale_usd;
    RAISE NOTICE '✓ Dropped orphaned column wholesale_usd';
  ELSE
    RAISE NOTICE '— wholesale_usd not found (already removed)';
  END IF;
END $$;

-- ── 5. Ensure all canonical columns exist (idempotent for fresh installs) ─────
DO $$ BEGIN
  -- srp
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='srp') THEN
    ALTER TABLE public.inventory ADD COLUMN srp NUMERIC(10,2) NOT NULL DEFAULT 0;
    RAISE NOTICE '✓ Added srp';
  END IF;
  -- wsp_usd
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='wsp_usd') THEN
    ALTER TABLE public.inventory ADD COLUMN wsp_usd NUMERIC(10,2) DEFAULT 0;
    RAISE NOTICE '✓ Added wsp_usd';
  END IF;
  -- stock_total
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='stock_total') THEN
    ALTER TABLE public.inventory ADD COLUMN stock_total INTEGER DEFAULT 0;
    RAISE NOTICE '✓ Added stock_total';
  END IF;
  -- cost
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='cost') THEN
    ALTER TABLE public.inventory ADD COLUMN cost NUMERIC(10,2);
    RAISE NOTICE '✓ Added cost';
  END IF;
  -- material
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='material') THEN
    ALTER TABLE public.inventory ADD COLUMN material TEXT;
    RAISE NOTICE '✓ Added material';
  END IF;
  -- delivery_window
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='delivery_window') THEN
    ALTER TABLE public.inventory ADD COLUMN delivery_window TEXT;
    RAISE NOTICE '✓ Added delivery_window';
  END IF;
  -- product_notes
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='product_notes') THEN
    ALTER TABLE public.inventory ADD COLUMN product_notes TEXT;
    RAISE NOTICE '✓ Added product_notes';
  END IF;
  -- moq
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='moq') THEN
    ALTER TABLE public.inventory ADD COLUMN moq INTEGER DEFAULT 1;
    RAISE NOTICE '✓ Added moq';
  END IF;
  -- margin
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='margin') THEN
    ALTER TABLE public.inventory ADD COLUMN margin NUMERIC(6,4) DEFAULT 0.5;
    RAISE NOTICE '✓ Added margin';
  END IF;
  -- brand_name
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='brand_name') THEN
    ALTER TABLE public.inventory ADD COLUMN brand_name TEXT NOT NULL DEFAULT 'Brand';
    RAISE NOTICE '✓ Added brand_name';
  END IF;
END $$;

-- ── 6. Backfill NULLs to safe defaults ────────────────────────────────────────
UPDATE public.inventory SET srp         = 0   WHERE srp         IS NULL;
UPDATE public.inventory SET wsp_usd     = 0   WHERE wsp_usd     IS NULL;
UPDATE public.inventory SET stock_total = 0   WHERE stock_total IS NULL;
UPDATE public.inventory SET moq         = 1   WHERE moq         IS NULL;
UPDATE public.inventory SET margin      = 0.5 WHERE margin      IS NULL;

-- ── 7. Add UNIQUE constraint on sku if not present (enables ON CONFLICT upsert)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.inventory'::regclass
      AND contype  = 'u'
      AND conname  IN ('inventory_sku_unique', 'inventory_sku_key')
  ) THEN
    IF (
      SELECT COUNT(*) FROM (
        SELECT sku FROM public.inventory
        WHERE sku IS NOT NULL AND sku != ''
        GROUP BY sku HAVING COUNT(*) > 1
      ) t
    ) = 0 THEN
      ALTER TABLE public.inventory ADD CONSTRAINT inventory_sku_unique UNIQUE (sku);
      RAISE NOTICE '✓ Added UNIQUE constraint on sku';
    ELSE
      RAISE NOTICE '⚠ Duplicate SKUs found — deduplicate first, then re-run';
    END IF;
  ELSE
    RAISE NOTICE '— UNIQUE(sku) already exists';
  END IF;
END $$;

-- ── 8. Performance indexes (guarded — only created if column exists) ───────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='srp') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_inventory_srp ON public.inventory (srp)';
    RAISE NOTICE '✓ Index srp';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='wsp_usd') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_inventory_wsp_usd ON public.inventory (wsp_usd)';
    RAISE NOTICE '✓ Index wsp_usd';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='stock_total') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_inventory_stock_total ON public.inventory (stock_total)';
    RAISE NOTICE '✓ Index stock_total';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='gender') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_inventory_gender ON public.inventory (gender)';
    RAISE NOTICE '✓ Index gender';
  ELSE
    RAISE NOTICE '— gender column not found, index skipped';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='color') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_inventory_color ON public.inventory (color)';
    RAISE NOTICE '✓ Index color';
  ELSE
    RAISE NOTICE '— color column not found, index skipped';
  END IF;
END $$;

-- ── 9. Final verification ──────────────────────────────────────────────────────
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'inventory'
ORDER BY ordinal_position;
