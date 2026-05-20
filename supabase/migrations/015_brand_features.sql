-- Brand promotions
CREATE TABLE IF NOT EXISTS brand_promotions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_name       TEXT NOT NULL,
  name             TEXT NOT NULL,
  headline         TEXT NOT NULL,
  description      TEXT,
  promo_type       TEXT NOT NULL CHECK (promo_type IN ('volume_discount','spend_threshold','category_deal','loyalty_reward')),
  discount_pct     DECIMAL(5,2) NOT NULL,
  min_qty          INT,
  min_spend        DECIMAL(14,2),
  target_category  TEXT,
  min_tier         TEXT DEFAULT 'silver',
  product_ids      INT[] DEFAULT '{}',
  expires_at       TIMESTAMPTZ,
  active           BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brand_promotion_assignments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID NOT NULL REFERENCES brand_promotions(id) ON DELETE CASCADE,
  buyer_id     UUID NOT NULL,
  assigned_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(promotion_id, buyer_id)
);

CREATE INDEX IF NOT EXISTS idx_brand_promotions_user   ON brand_promotions(brand_user_id);
CREATE INDEX IF NOT EXISTS idx_brand_promo_assignments ON brand_promotion_assignments(promotion_id);

-- Brand recommendation campaigns
CREATE TABLE IF NOT EXISTS brand_recommendation_campaigns (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_name    TEXT NOT NULL,
  name          TEXT NOT NULL,
  subject       TEXT NOT NULL,
  message       TEXT,
  product_ids   INT[] DEFAULT '{}',
  targeting     JSONB DEFAULT '{}',
  status        TEXT DEFAULT 'draft' CHECK (status IN ('draft','sent')),
  sent_at       TIMESTAMPTZ,
  recipient_count INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brand_recommendation_sends (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES brand_recommendation_campaigns(id) ON DELETE CASCADE,
  buyer_id    UUID NOT NULL,
  email       TEXT NOT NULL,
  match_score DECIMAL(5,2) DEFAULT 0,
  sent_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, buyer_id)
);

CREATE INDEX IF NOT EXISTS idx_brand_rec_campaigns ON brand_recommendation_campaigns(brand_user_id);
CREATE INDEX IF NOT EXISTS idx_brand_rec_sends     ON brand_recommendation_sends(campaign_id);

-- Buyer pricing rules (assigned by brands/admin to specific buyers)
CREATE TABLE IF NOT EXISTS buyer_pricing_rules (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_name   TEXT,
  buyer_id     UUID NOT NULL,
  rule_type    TEXT NOT NULL DEFAULT 'global' CHECK (rule_type IN ('global','category','brand','sku')),
  target       TEXT,
  discount_pct DECIMAL(5,2),
  fixed_price  DECIMAL(14,2),
  min_qty      INT,
  note         TEXT,
  active       BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buyer_pricing_rules_brand  ON buyer_pricing_rules(brand_name);
CREATE INDEX IF NOT EXISTS idx_buyer_pricing_rules_buyer  ON buyer_pricing_rules(buyer_id);

-- Buyer visibility rules (admin-controlled catalog filtering per buyer)
CREATE TABLE IF NOT EXISTS buyer_visibility_rules (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id  UUID NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('hide_category','hide_brand','hide_sku','show_only_category','show_only_brand')),
  target    TEXT NOT NULL,
  note      TEXT,
  active    BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buyer_visibility_rules ON buyer_visibility_rules(buyer_id);

-- RLS
ALTER TABLE brand_promotions                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_promotion_assignments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_recommendation_campaigns   ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_recommendation_sends       ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyer_pricing_rules              ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand owns promotions"         ON brand_promotions               FOR ALL  USING (auth.uid() = brand_user_id);
CREATE POLICY "brand owns promo assignments"  ON brand_promotion_assignments     FOR ALL  USING (
  promotion_id IN (SELECT id FROM brand_promotions WHERE brand_user_id = auth.uid())
);
CREATE POLICY "brand owns rec campaigns"      ON brand_recommendation_campaigns  FOR ALL  USING (auth.uid() = brand_user_id);
CREATE POLICY "brand owns rec sends"          ON brand_recommendation_sends      FOR ALL  USING (
  campaign_id IN (SELECT id FROM brand_recommendation_campaigns WHERE brand_user_id = auth.uid())
);
CREATE POLICY "brand manages pricing rules"   ON buyer_pricing_rules             FOR ALL  USING (
  brand_name IN (SELECT brand_name FROM brand_storefronts WHERE user_id = auth.uid())
);
CREATE POLICY "buyer reads own pricing rules" ON buyer_pricing_rules             FOR SELECT USING (auth.uid() = buyer_id);

ALTER TABLE buyer_visibility_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manages visibility rules" ON buyer_visibility_rules FOR ALL USING (auth.uid() IS NOT NULL);
