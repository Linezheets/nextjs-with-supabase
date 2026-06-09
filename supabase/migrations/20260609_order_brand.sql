-- ─────────────────────────────────────────────────────────────────────────────
-- One brand per order (audit theme C)
-- A top-level brand_name column replaces the fragile items[0] / items-contains
-- logic used for authorization and escrow payout. Orders are enforced
-- single-brand at creation; this column is the authoritative brand for an order.
-- Run in Supabase Dashboard → SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.buyer_orders ADD COLUMN IF NOT EXISTS brand_name TEXT;

CREATE INDEX IF NOT EXISTS idx_buyer_orders_brand_name ON public.buyer_orders (brand_name);

-- Backfill existing rows from the first item's brand_name.
UPDATE public.buyer_orders
   SET brand_name = items->0->>'brand_name'
 WHERE brand_name IS NULL
   AND jsonb_typeof(items) = 'array'
   AND jsonb_array_length(items) > 0;
