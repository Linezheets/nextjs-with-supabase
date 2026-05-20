-- ─────────────────────────────────────────────────────────────────────────────
-- Linezheets — brand promotions + top-account assignments
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Promotions ─────────────────────────────────────────────────────────────
-- A promotion is an offer a brand creates and can push to selected buyer accounts.
-- On assignment the platform auto-creates a matching buyer_pricing_rule.

CREATE TABLE IF NOT EXISTS public.brand_promotions (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_user_id   UUID          NOT NULL,
  brand_name      TEXT          NOT NULL,

  -- Display
  name            TEXT          NOT NULL,           -- internal label
  headline        TEXT          NOT NULL,           -- buyer-facing headline
  description     TEXT,                             -- longer offer description

  -- Promotion mechanics
  promo_type      TEXT          NOT NULL,
  -- 'volume_discount'   — buy min_qty+ units → discount_pct off
  -- 'spend_threshold'   — spend min_spend+ → discount_pct off all items
  -- 'category_deal'     — discount_pct off a specific category
  -- 'loyalty_reward'    — flat discount_pct off everything (thank-you reward)

  discount_pct    NUMERIC(5,2)  NOT NULL,           -- % off WSP
  min_qty         INTEGER,                          -- for volume_discount
  min_spend       NUMERIC(10,2),                    -- for spend_threshold
  target_category TEXT,                             -- for category_deal

  -- Targeting
  min_tier        TEXT          NOT NULL DEFAULT 'silver',
  -- only show accounts at or above this tier: silver | gold | platinum
  product_ids     BIGINT[]      NOT NULL DEFAULT '{}', -- featured in email

  -- Validity
  expires_at      TIMESTAMPTZ,
  active          BOOLEAN       NOT NULL DEFAULT true,

  -- Stats
  total_assigned  INTEGER       NOT NULL DEFAULT 0,

  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT promo_type_check CHECK (
    promo_type IN ('volume_discount','spend_threshold','category_deal','loyalty_reward')
  ),
  CONSTRAINT promo_tier_check CHECK (
    min_tier IN ('silver','gold','platinum')
  )
);

-- ── 2. Assignments ────────────────────────────────────────────────────────────
-- One row per buyer per promotion, tracks whether the discount has been pushed.

CREATE TABLE IF NOT EXISTS public.brand_promotion_assignments (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id    UUID          NOT NULL REFERENCES public.brand_promotions(id) ON DELETE CASCADE,
  brand_user_id   UUID          NOT NULL,
  buyer_id        UUID          NOT NULL REFERENCES public.buyers(id) ON DELETE CASCADE,
  buyer_email     TEXT          NOT NULL,
  account_tier    TEXT          NOT NULL DEFAULT 'silver',
  account_score   INTEGER       NOT NULL DEFAULT 0,

  -- Links to the auto-created pricing rule so it can be revoked
  pricing_rule_id UUID          REFERENCES public.buyer_pricing_rules(id) ON DELETE SET NULL,

  status          TEXT          NOT NULL DEFAULT 'active',
  -- active | redeemed | expired | revoked

  email_sent      BOOLEAN       NOT NULL DEFAULT false,
  email_sent_at   TIMESTAMPTZ,

  assigned_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  UNIQUE (promotion_id, buyer_id),

  CONSTRAINT assign_status_check CHECK (
    status IN ('active','redeemed','expired','revoked')
  )
);

-- ── 3. Triggers ───────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_bp_updated_at ON public.brand_promotions;
CREATE TRIGGER trg_bp_updated_at
  BEFORE UPDATE ON public.brand_promotions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 4. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bp_brand_user    ON public.brand_promotions           (brand_user_id);
CREATE INDEX IF NOT EXISTS idx_bpa_promotion    ON public.brand_promotion_assignments (promotion_id);
CREATE INDEX IF NOT EXISTS idx_bpa_buyer        ON public.brand_promotion_assignments (buyer_id);
CREATE INDEX IF NOT EXISTS idx_bpa_brand_user   ON public.brand_promotion_assignments (brand_user_id);

-- ── 5. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.brand_promotions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_promotion_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bp_owner_all"  ON public.brand_promotions;
DROP POLICY IF EXISTS "bpa_owner_all" ON public.brand_promotion_assignments;

CREATE POLICY "bp_owner_all"
  ON public.brand_promotions
  FOR ALL
  USING     (brand_user_id = auth.uid())
  WITH CHECK (brand_user_id = auth.uid());

CREATE POLICY "bpa_owner_all"
  ON public.brand_promotion_assignments
  FOR ALL
  USING     (brand_user_id = auth.uid())
  WITH CHECK (brand_user_id = auth.uid());
