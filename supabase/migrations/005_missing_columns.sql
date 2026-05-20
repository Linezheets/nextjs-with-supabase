-- ─────────────────────────────────────────────────────────────────────────────
-- Linezheets — 005 · Add missing inventory columns
-- Adds every column the server writes during smart-sync import.
-- Safe to run multiple times — all guarded with IF NOT EXISTS.
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN

  -- color
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='color') THEN
    ALTER TABLE public.inventory ADD COLUMN color TEXT;
    RAISE NOTICE '✓ Added color';
  END IF;

  -- gender
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='gender') THEN
    ALTER TABLE public.inventory ADD COLUMN gender TEXT NOT NULL DEFAULT 'UNISEX';
    RAISE NOTICE '✓ Added gender';
  END IF;

  -- season
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='season') THEN
    ALTER TABLE public.inventory ADD COLUMN season TEXT;
    RAISE NOTICE '✓ Added season';
  END IF;

  -- line  (collection line name — sometimes different from season)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='line') THEN
    ALTER TABLE public.inventory ADD COLUMN line TEXT;
    RAISE NOTICE '✓ Added line';
  END IF;

  -- tags  (text array for search / filtering)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='tags') THEN
    ALTER TABLE public.inventory ADD COLUMN tags TEXT[] NOT NULL DEFAULT '{}';
    RAISE NOTICE '✓ Added tags';
  END IF;

  -- tier_pricing  (JSONB array: [{tier_name, min_qty, discount_pct}, …])
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='tier_pricing') THEN
    ALTER TABLE public.inventory ADD COLUMN tier_pricing JSONB NOT NULL DEFAULT '[]';
    RAISE NOTICE '✓ Added tier_pricing';
  END IF;

  -- brand_id  (integer FK — soft reference, no FK constraint yet)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='brand_id') THEN
    ALTER TABLE public.inventory ADD COLUMN brand_id INTEGER NOT NULL DEFAULT 1;
    RAISE NOTICE '✓ Added brand_id';
  END IF;

  -- title  (display alias — server stores product name in description; title mirrors it)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='title') THEN
    ALTER TABLE public.inventory ADD COLUMN title TEXT GENERATED ALWAYS AS (description) STORED;
    RAISE NOTICE '✓ Added title (generated from description)';
  END IF;

  -- updated_at  (auto-updated by trigger)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='updated_at') THEN
    ALTER TABLE public.inventory ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    RAISE NOTICE '✓ Added updated_at';
  END IF;

  -- status  (draft | active | archived — upload pipeline sets draft)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='status') THEN
    ALTER TABLE public.inventory ADD COLUMN status TEXT NOT NULL DEFAULT 'draft';
    RAISE NOTICE '✓ Added status';
  END IF;

END $$;

-- ── Backfill defaults on existing rows ────────────────────────────────────────
UPDATE public.inventory SET gender      = 'UNISEX' WHERE gender      IS NULL;
UPDATE public.inventory SET tags        = '{}'     WHERE tags        IS NULL;
UPDATE public.inventory SET tier_pricing = '[]'   WHERE tier_pricing IS NULL;
UPDATE public.inventory SET brand_id    = 1        WHERE brand_id    IS NULL;
UPDATE public.inventory SET status      = 'active' WHERE status      IS NULL;  -- existing rows are already live

-- ── Auto-update trigger for updated_at ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_updated_at ON public.inventory;
CREATE TRIGGER trg_inventory_updated_at
  BEFORE UPDATE ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Indexes on new columns ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_inventory_gender   ON public.inventory (gender);
CREATE INDEX IF NOT EXISTS idx_inventory_color    ON public.inventory (color);
CREATE INDEX IF NOT EXISTS idx_inventory_season   ON public.inventory (season);
CREATE INDEX IF NOT EXISTS idx_inventory_status   ON public.inventory (status);
CREATE INDEX IF NOT EXISTS idx_inventory_brand_id ON public.inventory (brand_id);

-- ── Final verification ────────────────────────────────────────────────────────
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'inventory'
ORDER BY ordinal_position;
