-- ─────────────────────────────────────────────────────────────────────────────
-- Linezheets — per-buyer pricing rules + visibility rules
-- Run in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Buyer pricing rules ────────────────────────────────────────────────────
-- Priority: sku > brand > category > global
-- Either discount_pct (%) or fixed_price (absolute WSP override) must be set.

CREATE TABLE IF NOT EXISTS public.buyer_pricing_rules (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id      UUID          NOT NULL REFERENCES public.buyers(id) ON DELETE CASCADE,
  rule_type     TEXT          NOT NULL,   -- 'global' | 'category' | 'brand' | 'sku'
  target        TEXT,                     -- NULL for global; category/brand name or SKU value
  discount_pct  NUMERIC(5,2),            -- e.g. 15.00 = 15% off WSP
  fixed_price   NUMERIC(10,2),           -- override to exact wholesale price
  active        BOOLEAN       NOT NULL DEFAULT true,
  note          TEXT,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT pricing_rule_type  CHECK (rule_type IN ('global','category','brand','sku')),
  CONSTRAINT pricing_has_value  CHECK (discount_pct IS NOT NULL OR fixed_price IS NOT NULL),
  CONSTRAINT pricing_target_req CHECK (rule_type = 'global' OR target IS NOT NULL)
);

-- ── 2. Buyer visibility rules ─────────────────────────────────────────────────
-- hide_* rules exclude matching items.
-- show_only_* rules are whitelists — if any show_only rule exists for this
-- buyer, only matching items are shown (per dimension).

CREATE TABLE IF NOT EXISTS public.buyer_visibility_rules (
  id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id   UUID          NOT NULL REFERENCES public.buyers(id) ON DELETE CASCADE,
  rule_type  TEXT          NOT NULL,   -- 'hide_category' | 'hide_brand' | 'hide_sku'
                                       -- | 'show_only_category' | 'show_only_brand'
  target     TEXT          NOT NULL,
  active     BOOLEAN       NOT NULL DEFAULT true,
  note       TEXT,
  created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT visibility_rule_type CHECK (
    rule_type IN ('hide_category','hide_brand','hide_sku','show_only_category','show_only_brand')
  )
);

-- ── 3. Auto-update trigger ────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_buyer_pricing_rules_updated_at ON public.buyer_pricing_rules;
CREATE TRIGGER trg_buyer_pricing_rules_updated_at
  BEFORE UPDATE ON public.buyer_pricing_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 4. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bpr_buyer_id   ON public.buyer_pricing_rules    (buyer_id);
CREATE INDEX IF NOT EXISTS idx_bvr_buyer_id   ON public.buyer_visibility_rules (buyer_id);
CREATE INDEX IF NOT EXISTS idx_bpr_type_target ON public.buyer_pricing_rules   (buyer_id, rule_type, target);

-- ── 5. RLS — service role only ────────────────────────────────────────────────
ALTER TABLE public.buyer_pricing_rules    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_visibility_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bpr_service_all" ON public.buyer_pricing_rules;
DROP POLICY IF EXISTS "bvr_service_all" ON public.buyer_visibility_rules;

CREATE POLICY "bpr_service_all" ON public.buyer_pricing_rules    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "bvr_service_all" ON public.buyer_visibility_rules FOR ALL USING (true) WITH CHECK (true);

-- ── 6. get_buyer_catalog RPC ──────────────────────────────────────────────────
-- Returns inventory rows visible to the given buyer, with wholesale_price
-- adjusted by their highest-priority active pricing rule.
-- Rule priority (highest → lowest): sku > brand > category > global

CREATE OR REPLACE FUNCTION public.get_buyer_catalog(p_buyer_id UUID)
RETURNS TABLE (
  id               BIGINT,
  title            TEXT,
  sku              TEXT,
  category         TEXT,
  brand_name       TEXT,
  brand_id         INTEGER,
  gender           TEXT,
  color            TEXT,
  season           TEXT,
  line             TEXT,
  tags             TEXT[],
  description      TEXT,
  retail_price     NUMERIC,   -- SRP (original, unchanged)
  wholesale_price  NUMERIC,   -- buyer-adjusted WSP
  base_wsp         NUMERIC,   -- original WSP before adjustment
  moq              INTEGER,
  delivery_window  TEXT,
  image_urls       TEXT[],
  sizes            JSONB,
  tier_pricing     JSONB,
  inventory_status TEXT,
  stock_total      INTEGER,
  created_at       TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_has_show_only_cat  BOOLEAN;
  v_has_show_only_brand BOOLEAN;
BEGIN
  -- Check if buyer has any whitelist rules active
  SELECT EXISTS (
    SELECT 1 FROM public.buyer_visibility_rules
    WHERE buyer_id = p_buyer_id AND rule_type = 'show_only_category' AND active = true
  ) INTO v_has_show_only_cat;

  SELECT EXISTS (
    SELECT 1 FROM public.buyer_visibility_rules
    WHERE buyer_id = p_buyer_id AND rule_type = 'show_only_brand' AND active = true
  ) INTO v_has_show_only_brand;

  RETURN QUERY
  WITH

  -- Collect active rules for this buyer
  pricing AS (
    SELECT rule_type, target, discount_pct, fixed_price
    FROM   public.buyer_pricing_rules
    WHERE  buyer_id = p_buyer_id AND active = true
  ),
  visibility AS (
    SELECT rule_type, target
    FROM   public.buyer_visibility_rules
    WHERE  buyer_id = p_buyer_id AND active = true
  ),

  -- Base catalog: active inventory items
  base AS (
    SELECT
      inv.id,
      inv.title,
      inv.sku,
      inv.category,
      inv.brand_name,
      inv.brand_id,
      inv.gender,
      inv.color,
      inv.season,
      inv.line,
      inv.tags,
      inv.description,
      COALESCE(inv.srp,         inv.srp_usd,       0)  AS retail_price,
      COALESCE(inv.wsp_usd,     inv.wholesale_usd,
               inv.srp * 0.40, inv.srp_usd * 0.40, 0) AS base_wsp,
      inv.moq,
      inv.delivery_window,
      inv.image_urls,
      inv.sizes,
      inv.tier_pricing,
      CASE
        WHEN COALESCE(inv.stock_total, inv.stock, 0) = 0           THEN 'Out of Stock'
        WHEN COALESCE(inv.stock_total, inv.stock, 0) <= 5          THEN 'Low Stock'
        WHEN inv.delivery_window IS NOT NULL
             AND inv.delivery_window NOT ILIKE '%now%'              THEN 'Pre-Order'
        ELSE                                                              'Ready to Ship'
      END AS inventory_status,
      COALESCE(inv.stock_total, inv.stock, 0) AS stock_total,
      inv.created_at,
      inv.updated_at
    FROM public.inventory inv
    WHERE inv.status = 'active'
  ),

  -- Apply visibility filtering
  visible AS (
    SELECT b.*
    FROM base b
    WHERE
      -- Exclude hidden SKUs
      NOT EXISTS (
        SELECT 1 FROM visibility v
        WHERE v.rule_type = 'hide_sku' AND v.target = b.sku
      )
      -- Exclude hidden categories
      AND NOT EXISTS (
        SELECT 1 FROM visibility v
        WHERE v.rule_type = 'hide_category' AND v.target = b.category
      )
      -- Exclude hidden brands
      AND NOT EXISTS (
        SELECT 1 FROM visibility v
        WHERE v.rule_type = 'hide_brand' AND v.target = b.brand_name
      )
      -- Whitelist: category (only apply if show_only_category rules exist)
      AND (
        NOT v_has_show_only_cat
        OR EXISTS (
          SELECT 1 FROM visibility v
          WHERE v.rule_type = 'show_only_category' AND v.target = b.category
        )
      )
      -- Whitelist: brand (only apply if show_only_brand rules exist)
      AND (
        NOT v_has_show_only_brand
        OR EXISTS (
          SELECT 1 FROM visibility v
          WHERE v.rule_type = 'show_only_brand' AND v.target = b.brand_name
        )
      )
  ),

  -- Resolve best pricing rule per item (priority: sku > brand > category > global)
  priced AS (
    SELECT
      vis.*,
      COALESCE(
        -- 1. SKU-level fixed price
        (SELECT fixed_price FROM pricing p WHERE p.rule_type = 'sku' AND p.target = vis.sku AND p.fixed_price IS NOT NULL LIMIT 1),
        -- 2. SKU-level discount
        CASE WHEN EXISTS (SELECT 1 FROM pricing p WHERE p.rule_type = 'sku' AND p.target = vis.sku AND p.discount_pct IS NOT NULL)
          THEN vis.base_wsp * (1 - (SELECT discount_pct FROM pricing p WHERE p.rule_type = 'sku' AND p.target = vis.sku AND p.discount_pct IS NOT NULL LIMIT 1) / 100.0)
          ELSE NULL
        END,
        -- 3. Brand-level fixed price
        (SELECT fixed_price FROM pricing p WHERE p.rule_type = 'brand' AND p.target = vis.brand_name AND p.fixed_price IS NOT NULL LIMIT 1),
        -- 4. Brand-level discount
        CASE WHEN EXISTS (SELECT 1 FROM pricing p WHERE p.rule_type = 'brand' AND p.target = vis.brand_name AND p.discount_pct IS NOT NULL)
          THEN vis.base_wsp * (1 - (SELECT discount_pct FROM pricing p WHERE p.rule_type = 'brand' AND p.target = vis.brand_name AND p.discount_pct IS NOT NULL LIMIT 1) / 100.0)
          ELSE NULL
        END,
        -- 5. Category-level fixed price
        (SELECT fixed_price FROM pricing p WHERE p.rule_type = 'category' AND p.target = vis.category AND p.fixed_price IS NOT NULL LIMIT 1),
        -- 6. Category-level discount
        CASE WHEN EXISTS (SELECT 1 FROM pricing p WHERE p.rule_type = 'category' AND p.target = vis.category AND p.discount_pct IS NOT NULL)
          THEN vis.base_wsp * (1 - (SELECT discount_pct FROM pricing p WHERE p.rule_type = 'category' AND p.target = vis.category AND p.discount_pct IS NOT NULL LIMIT 1) / 100.0)
          ELSE NULL
        END,
        -- 7. Global discount
        CASE WHEN EXISTS (SELECT 1 FROM pricing p WHERE p.rule_type = 'global' AND p.discount_pct IS NOT NULL)
          THEN vis.base_wsp * (1 - (SELECT discount_pct FROM pricing p WHERE p.rule_type = 'global' AND p.discount_pct IS NOT NULL LIMIT 1) / 100.0)
          ELSE NULL
        END,
        -- 8. Global fixed price
        (SELECT fixed_price FROM pricing p WHERE p.rule_type = 'global' AND p.fixed_price IS NOT NULL LIMIT 1),
        -- Fallback: standard WSP
        vis.base_wsp
      ) AS wholesale_price
    FROM visible vis
  )

  SELECT
    p.id,
    p.title,
    p.sku,
    p.category,
    p.brand_name,
    p.brand_id,
    p.gender,
    p.color,
    p.season,
    p.line,
    p.tags,
    p.description,
    p.retail_price,
    p.wholesale_price,
    p.base_wsp,
    p.moq,
    p.delivery_window,
    p.image_urls,
    p.sizes,
    p.tier_pricing,
    p.inventory_status,
    p.stock_total,
    p.created_at,
    p.updated_at
  FROM priced p
  ORDER BY p.created_at DESC;

END;
$$;

-- Grant execute to authenticated users (they'll pass their own buyer ID from the app)
GRANT EXECUTE ON FUNCTION public.get_buyer_catalog(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_buyer_catalog(UUID) TO anon;
