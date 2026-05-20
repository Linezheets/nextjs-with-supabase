-- ─────────────────────────────────────────────────────────────────────────────
-- Linezheets — buyers + buyer_analysis tables
-- Paste into Supabase Dashboard → SQL Editor → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Buyers table
CREATE TABLE IF NOT EXISTS public.buyers (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  email               TEXT         UNIQUE NOT NULL,
  store_name          TEXT         NOT NULL,
  password_hash       TEXT         NOT NULL,
  temp_password       BOOLEAN      NOT NULL DEFAULT true,   -- true = must onboard
  status              TEXT         NOT NULL DEFAULT 'pending', -- pending | active | suspended

  -- Profile (filled during onboarding)
  first_name          TEXT,
  last_name           TEXT,
  phone               TEXT,
  store_address       TEXT,
  city                TEXT,
  country             TEXT         DEFAULT 'US',
  store_url           TEXT,
  instagram           TEXT,
  tiktok              TEXT,
  linkedin            TEXT,
  other_socials       TEXT,

  -- Store intel (AI analysis inputs — entered during onboarding)
  store_type          TEXT,        -- boutique | department | online | multi-brand | concept
  categories_sold     TEXT[]       NOT NULL DEFAULT '{}',
  price_range_min     NUMERIC(10,2),
  price_range_max     NUMERIC(10,2),
  market_segment      TEXT,        -- luxury | premium | contemporary | streetwear | fast-fashion
  annual_buy_budget   NUMERIC(12,2),

  -- Metadata
  registered_by       TEXT,        -- brand name or 'platform'
  registered_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  onboarded_at        TIMESTAMPTZ,
  last_login_at       TIMESTAMPTZ,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 2. Buyer analysis table (internal only — not exposed to members)
CREATE TABLE IF NOT EXISTS public.buyer_analysis (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id              UUID         NOT NULL REFERENCES public.buyers(id) ON DELETE CASCADE,

  -- Derived intelligence
  style_dna             JSONB        NOT NULL DEFAULT '{}',   -- {minimalist:0.8, editorial:0.6, ...}
  price_sensitivity     TEXT,                                  -- luxury|premium|contemporary|accessible
  category_weights      JSONB        NOT NULL DEFAULT '{}',   -- {TOPS:0.9, BOTTOMS:0.6, ...}
  trend_alignment       TEXT,                                  -- early-adopter|trend-follower|classic

  -- Content matching
  personalization_tags  TEXT[]       NOT NULL DEFAULT '{}',
  newsletter_topics     TEXT[]       NOT NULL DEFAULT '{}',
  brand_affinities      TEXT[]       NOT NULL DEFAULT '{}',

  -- Behavioural (updated on each order)
  avg_order_value       NUMERIC(10,2),
  total_orders          INTEGER      NOT NULL DEFAULT 0,
  total_spend           NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Meta
  analyzed_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  version               INTEGER      NOT NULL DEFAULT 1,

  UNIQUE(buyer_id)   -- one analysis record per buyer (upsert on conflict)
);

-- 3. Auto-update trigger (reuse set_updated_at from 001_inventory.sql)
DROP TRIGGER IF EXISTS trg_buyers_updated_at ON public.buyers;
CREATE TRIGGER trg_buyers_updated_at
  BEFORE UPDATE ON public.buyers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_buyers_email          ON public.buyers (email);
CREATE INDEX IF NOT EXISTS idx_buyers_status         ON public.buyers (status);
CREATE INDEX IF NOT EXISTS idx_buyers_registered_by  ON public.buyers (registered_by);
CREATE INDEX IF NOT EXISTS idx_buyer_analysis_buyer  ON public.buyer_analysis (buyer_id);

-- 5. RLS — service role bypasses; anon cannot read buyer data
ALTER TABLE public.buyers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_analysis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "buyers_service_all"          ON public.buyers;
DROP POLICY IF EXISTS "buyer_analysis_service_all"  ON public.buyer_analysis;

-- Only service-role (server) can touch these tables
CREATE POLICY "buyers_service_all"
  ON public.buyers FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "buyer_analysis_service_all"
  ON public.buyer_analysis FOR ALL USING (true) WITH CHECK (true);
