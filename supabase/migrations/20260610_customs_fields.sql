-- ─────────────────────────────────────────────────────────────────────────────
-- Customs / commercial-invoice product fields (audit theme M part 1)
-- Enables customs-clearance-ready invoices: HS code, country of origin, and
-- per-unit net/gross weight. Captured on linesheet import; rendered on invoices.
-- Run in Supabase Dashboard → SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS hs_code           TEXT,
  ADD COLUMN IF NOT EXISTS country_of_origin TEXT,
  ADD COLUMN IF NOT EXISTS net_weight_kg     NUMERIC(10,3),
  ADD COLUMN IF NOT EXISTS gross_weight_kg   NUMERIC(10,3);

COMMENT ON COLUMN public.inventory.hs_code           IS 'Harmonized System tariff code for customs declaration';
COMMENT ON COLUMN public.inventory.country_of_origin IS 'Country where the goods were manufactured (customs origin)';
COMMENT ON COLUMN public.inventory.net_weight_kg     IS 'Per-unit net weight (kg) for customs/shipping';
COMMENT ON COLUMN public.inventory.gross_weight_kg   IS 'Per-unit gross weight (kg) for customs/shipping';
