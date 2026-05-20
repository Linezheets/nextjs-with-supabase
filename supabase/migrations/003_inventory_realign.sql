-- ─────────────────────────────────────────────────────────────────────────────
-- Linezheets — inventory schema realignment
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Rename srp_usd → retail_srp  (if still on old name)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory' AND column_name = 'srp_usd'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory' AND column_name = 'retail_srp'
  ) THEN
    ALTER TABLE public.inventory RENAME COLUMN srp_usd TO retail_srp;
    RAISE NOTICE 'Renamed srp_usd → retail_srp';
  ELSE
    RAISE NOTICE 'srp_usd rename skipped (already renamed or column missing)';
  END IF;
END $$;

-- 2. Rename stock → stock_total  (if still on old name)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory' AND column_name = 'stock'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory' AND column_name = 'stock_total'
  ) THEN
    ALTER TABLE public.inventory RENAME COLUMN stock TO stock_total;
    RAISE NOTICE 'Renamed stock → stock_total';
  ELSE
    RAISE NOTICE 'stock rename skipped (already renamed or column missing)';
  END IF;
END $$;

-- 3. Add any missing columns (all safe — IF NOT EXISTS via DO block)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='wsp_usd') THEN
    ALTER TABLE public.inventory ADD COLUMN wsp_usd NUMERIC(10,2) DEFAULT 0;
    RAISE NOTICE 'Added wsp_usd';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='retail_srp') THEN
    ALTER TABLE public.inventory ADD COLUMN retail_srp NUMERIC(10,2) DEFAULT 0;
    RAISE NOTICE 'Added retail_srp';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='stock_total') THEN
    ALTER TABLE public.inventory ADD COLUMN stock_total INTEGER DEFAULT 0;
    RAISE NOTICE 'Added stock_total';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='product_notes') THEN
    ALTER TABLE public.inventory ADD COLUMN product_notes TEXT;
    RAISE NOTICE 'Added product_notes';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='moq') THEN
    ALTER TABLE public.inventory ADD COLUMN moq INTEGER DEFAULT 1;
    RAISE NOTICE 'Added moq';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='margin') THEN
    ALTER TABLE public.inventory ADD COLUMN margin NUMERIC(6,4) DEFAULT 0.5;
    RAISE NOTICE 'Added margin';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='cost') THEN
    ALTER TABLE public.inventory ADD COLUMN cost NUMERIC(10,2);
    RAISE NOTICE 'Added cost';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='delivery_window') THEN
    ALTER TABLE public.inventory ADD COLUMN delivery_window TEXT;
    RAISE NOTICE 'Added delivery_window';
  END IF;
END $$;

-- 4. Backfill NULLs to 0
UPDATE public.inventory SET retail_srp  = 0 WHERE retail_srp  IS NULL;
UPDATE public.inventory SET stock_total = 0 WHERE stock_total IS NULL;

-- 5. Add UNIQUE constraint on sku (enables native ON CONFLICT upsert)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.inventory'::regclass
      AND contype = 'u'
      AND conname = 'inventory_sku_unique'
  ) THEN
    IF (
      SELECT COUNT(*) FROM (
        SELECT sku FROM public.inventory
        WHERE sku IS NOT NULL AND sku != ''
        GROUP BY sku HAVING COUNT(*) > 1
      ) t
    ) = 0 THEN
      ALTER TABLE public.inventory ADD CONSTRAINT inventory_sku_unique UNIQUE (sku);
      RAISE NOTICE 'Added UNIQUE constraint on sku';
    ELSE
      RAISE NOTICE 'Duplicate SKUs exist — deduplicate first, then re-run';
    END IF;
  ELSE
    RAISE NOTICE 'UNIQUE(sku) already exists';
  END IF;
END $$;

-- 6. Verify — show final column list
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'inventory'
ORDER BY ordinal_position;
