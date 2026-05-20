-- ─────────────────────────────────────────────────────────────────────────────
-- Linezheets — brand buying-recommendation campaigns
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Campaigns ─────────────────────────────────────────────────────────────
-- One row per outbound recommendation batch a brand creates.

CREATE TABLE IF NOT EXISTS public.brand_recommendation_campaigns (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_user_id   UUID          NOT NULL,             -- auth.uid() of the brand
  brand_name      TEXT          NOT NULL,
  name            TEXT          NOT NULL,             -- internal campaign label
  subject         TEXT          NOT NULL,             -- email subject line
  message         TEXT,                               -- personalised intro copy
  product_ids     BIGINT[]      NOT NULL DEFAULT '{}',-- inventory item IDs to feature
  targeting       JSONB         NOT NULL DEFAULT '{}',
  -- targeting shape:
  -- {
  --   "categories":       ["TOPS","OUTERWEAR"],   -- match buyers.categories_sold
  --   "market_segments":  ["luxury","premium"],   -- match buyers.market_segment
  --   "price_max":        500,                    -- buyer.price_range_max ceiling
  --   "all_buyers":       false                   -- override: send to all active buyers
  -- }
  status          TEXT          NOT NULL DEFAULT 'draft', -- draft | sent
  sent_at         TIMESTAMPTZ,
  total_sent      INTEGER       NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT campaign_status CHECK (status IN ('draft','sent'))
);

-- ── 2. Sends ──────────────────────────────────────────────────────────────────
-- One row per buyer per campaign send.

CREATE TABLE IF NOT EXISTS public.brand_recommendation_sends (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID          NOT NULL REFERENCES public.brand_recommendation_campaigns(id) ON DELETE CASCADE,
  buyer_id    UUID          NOT NULL REFERENCES public.buyers(id) ON DELETE CASCADE,
  buyer_email TEXT          NOT NULL,
  match_score INTEGER       NOT NULL DEFAULT 0,   -- 0-100 relevance score
  sent_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  UNIQUE (campaign_id, buyer_id)
);

-- ── 3. Triggers ───────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_brc_updated_at ON public.brand_recommendation_campaigns;
CREATE TRIGGER trg_brc_updated_at
  BEFORE UPDATE ON public.brand_recommendation_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 4. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_brc_brand_user ON public.brand_recommendation_campaigns (brand_user_id);
CREATE INDEX IF NOT EXISTS idx_brc_status      ON public.brand_recommendation_campaigns (status);
CREATE INDEX IF NOT EXISTS idx_brs_campaign    ON public.brand_recommendation_sends (campaign_id);
CREATE INDEX IF NOT EXISTS idx_brs_buyer       ON public.brand_recommendation_sends (buyer_id);

-- ── 5. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.brand_recommendation_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_recommendation_sends     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brc_owner_all" ON public.brand_recommendation_campaigns;
DROP POLICY IF EXISTS "brs_service"   ON public.brand_recommendation_sends;

-- Brands manage their own campaigns
CREATE POLICY "brc_owner_all"
  ON public.brand_recommendation_campaigns
  FOR ALL
  USING     (brand_user_id = auth.uid())
  WITH CHECK (brand_user_id = auth.uid());

-- Sends: service role only (written server-side during the send job)
CREATE POLICY "brs_service"
  ON public.brand_recommendation_sends
  FOR ALL USING (true) WITH CHECK (true);
