-- ─────────────────────────────────────────────────────────────────────────────
-- Brand pricing settings (audit theme I — D2-2)
-- The Margin Settings screen PATCHed a route that never existed, so margin /
-- markup / payment-term defaults were never saved. This column persists them.
-- Run in Supabase Dashboard → SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.brand_storefronts
  ADD COLUMN IF NOT EXISTS pricing_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.brand_storefronts.pricing_settings IS
  'Brand pricing defaults: default_margin_pct, min_margin_pct, target_markup, currency, payment_terms_days, discount_tiers[]';
