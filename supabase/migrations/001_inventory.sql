-- ─────────────────────────────────────────────────────────────────────────────
-- Linezheets — inventory table
-- Paste this entire block into Supabase Dashboard → SQL Editor → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- 1.  Create the table if it doesn't exist yet
CREATE TABLE IF NOT EXISTS public.inventory (
  id               BIGSERIAL    PRIMARY KEY,
  title            TEXT         NOT NULL,
  sku              TEXT         UNIQUE,
  category         TEXT         NOT NULL DEFAULT 'GENERAL',
  stock            INTEGER      NOT NULL DEFAULT 0,
  sizes            JSONB        NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 2.  Add every column the server expects (safe to run on an existing table)
DO $$ BEGIN

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory' AND column_name='gender')
    THEN ALTER TABLE public.inventory ADD COLUMN gender TEXT NOT NULL DEFAULT 'UNISEX'; END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory' AND column_name='color')
    THEN ALTER TABLE public.inventory ADD COLUMN color TEXT; END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory' AND column_name='season')
    THEN ALTER TABLE public.inventory ADD COLUMN season TEXT; END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory' AND column_name='line')
    THEN ALTER TABLE public.inventory ADD COLUMN line TEXT; END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory' AND column_name='brand_name')
    THEN ALTER TABLE public.inventory ADD COLUMN brand_name TEXT NOT NULL DEFAULT 'My Brand'; END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory' AND column_name='brand_id')
    THEN ALTER TABLE public.inventory ADD COLUMN brand_id INTEGER NOT NULL DEFAULT 1; END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory' AND column_name='tags')
    THEN ALTER TABLE public.inventory ADD COLUMN tags TEXT[] NOT NULL DEFAULT '{}'; END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory' AND column_name='srp_usd')
    THEN ALTER TABLE public.inventory ADD COLUMN srp_usd NUMERIC(10,2) NOT NULL DEFAULT 0; END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory' AND column_name='margin')
    THEN ALTER TABLE public.inventory ADD COLUMN margin NUMERIC(5,4) NOT NULL DEFAULT 0.5; END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory' AND column_name='moq')
    THEN ALTER TABLE public.inventory ADD COLUMN moq INTEGER NOT NULL DEFAULT 1; END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory' AND column_name='delivery_window')
    THEN ALTER TABLE public.inventory ADD COLUMN delivery_window TEXT; END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory' AND column_name='image_urls')
    THEN ALTER TABLE public.inventory ADD COLUMN image_urls TEXT[] NOT NULL DEFAULT '{}'; END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory' AND column_name='tier_pricing')
    THEN ALTER TABLE public.inventory ADD COLUMN tier_pricing JSONB NOT NULL DEFAULT '[]'; END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory' AND column_name='description')
    THEN ALTER TABLE public.inventory ADD COLUMN description TEXT; END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory' AND column_name='cost')
    THEN ALTER TABLE public.inventory ADD COLUMN cost NUMERIC(10,2); END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory' AND column_name='wholesale_usd')
    THEN ALTER TABLE public.inventory ADD COLUMN wholesale_usd NUMERIC(10,2); END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory' AND column_name='updated_at')
    THEN ALTER TABLE public.inventory ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(); END IF;

END $$;

-- 3.  Ensure sku has a UNIQUE constraint (needed for upsert ON CONFLICT)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='inventory' AND constraint_type='UNIQUE'
      AND constraint_name='inventory_sku_key'
  ) THEN
    ALTER TABLE public.inventory ADD CONSTRAINT inventory_sku_key UNIQUE (sku);
  END IF;
END $$;

-- 5.  Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_updated_at ON public.inventory;
CREATE TRIGGER trg_inventory_updated_at
  BEFORE UPDATE ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6.  Indexes
CREATE INDEX IF NOT EXISTS idx_inventory_category  ON public.inventory (category);
CREATE INDEX IF NOT EXISTS idx_inventory_season    ON public.inventory (season);
CREATE INDEX IF NOT EXISTS idx_inventory_sku       ON public.inventory (sku);
CREATE INDEX IF NOT EXISTS idx_inventory_stock     ON public.inventory (stock_total);
CREATE INDEX IF NOT EXISTS idx_inventory_brand     ON public.inventory (brand_name);

-- 7.  Row-Level Security
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventory_select_all"          ON public.inventory;
DROP POLICY IF EXISTS "inventory_write_authenticated"  ON public.inventory;

-- Anyone can read (buyer shop, marketplace)
CREATE POLICY "inventory_select_all"
  ON public.inventory FOR SELECT USING (true);

-- Only authenticated users can write
CREATE POLICY "inventory_write_authenticated"
  ON public.inventory FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 8.  Seed starter SKUs (safe — skips if SKU already exists)
INSERT INTO public.inventory
  (title, sku, category, gender, color, season, brand_name, brand_id, tags,
   srp_usd, margin, moq, sizes, stock, delivery_window, image_urls, tier_pricing)
VALUES
  ('Silk Blazer','LZ-BLZ-001','OUTERWEAR','WOMEN','Ivory','SS27','Luxury Lab',1,
   ARRAY['ivory','luxury','blazer','ss27'],1200,0.50,5,
   '{"XS":3,"S":8,"M":15,"L":12,"XL":7}'::jsonb,45,'Jun–Jul 2026',
   ARRAY['https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=800&q=80'],
   '[{"tier_name":"Silver","min_qty":10,"discount_pct":5},{"tier_name":"Gold","min_qty":25,"discount_pct":10}]'::jsonb),

  ('Cashmere Trouser','LZ-TRS-002','BOTTOMS','WOMEN','Black','AW27','Luxury Lab',1,
   ARRAY['black','cashmere','trousers','aw27'],850,0.50,10,
   '{"XS":1,"S":3,"M":4,"L":3,"XL":1}'::jsonb,12,'Aug–Sep 2026',
   ARRAY['https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&w=800&q=80'],
   '[{"tier_name":"Silver","min_qty":20,"discount_pct":5},{"tier_name":"Gold","min_qty":50,"discount_pct":12}]'::jsonb),

  ('Minimalist Tote','LZ-TOT-003','ACCESSORIES','UNISEX','Tan','SS27','Luxury Lab',1,
   ARRAY['tan','leather','tote','ss27'],450,0.45,20,
   '{"OS":88}'::jsonb,88,'May–Jun 2026',
   ARRAY['https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80'],
   '[{"tier_name":"Silver","min_qty":40,"discount_pct":5},{"tier_name":"Gold","min_qty":100,"discount_pct":10}]'::jsonb),

  ('Leather Chelsea Boot','LZ-BOT-004','FOOTWEAR','UNISEX','Black','AW27','Luxury Lab',1,
   ARRAY['black','leather','chelsea','boots','aw27'],650,0.48,8,
   '{"36":1,"37":2,"38":1,"39":1}'::jsonb,5,'Sep–Oct 2026',
   ARRAY['https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80'],
   '[{"tier_name":"Silver","min_qty":16,"discount_pct":5},{"tier_name":"Gold","min_qty":40,"discount_pct":10}]'::jsonb),

  ('Linen Midi Dress','LZ-DRS-005','DRESSES','WOMEN','Sand','SS27','Luxury Lab',1,
   ARRAY['sand','linen','dress','ss27'],520,0.50,6,
   '{"XS":5,"S":12,"M":18,"L":10,"XL":4}'::jsonb,49,'Apr–May 2026',
   ARRAY['https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=800&q=80'],
   '[{"tier_name":"Silver","min_qty":12,"discount_pct":5},{"tier_name":"Gold","min_qty":30,"discount_pct":10}]'::jsonb),

  ('Merino Knit Cardigan','LZ-KNT-006','KNITWEAR','WOMEN','Camel','AW27','Luxury Lab',1,
   ARRAY['camel','merino','cardigan','aw27'],680,0.50,8,
   '{"XS":4,"S":10,"M":14,"L":8,"XL":3}'::jsonb,39,'Jul–Aug 2026',
   ARRAY['https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=800&q=80'],
   '[{"tier_name":"Silver","min_qty":16,"discount_pct":5},{"tier_name":"Gold","min_qty":40,"discount_pct":10}]'::jsonb)

ON CONFLICT (sku) DO NOTHING;
