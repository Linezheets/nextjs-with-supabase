-- ─────────────────────────────────────────────────────────────────────────────
-- Expose style_id + color_hex (+ video_urls) on buyer_vip_catalog
-- ─────────────────────────────────────────────────────────────────────────────
-- The buyer storefront reads buyer_vip_catalog (explicit-column view), which was
-- created before the colourway-grouping migration — so it doesn't surface style_id
-- or color_hex. The storefront needs these to group a style's colourways into one
-- product card with colour swatches. Additive (adds columns at the end of the view).
-- Idempotent (DROP + CREATE). Safe on prod.
-- ─────────────────────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS public.buyer_vip_catalog;
CREATE VIEW public.buyer_vip_catalog AS
SELECT
  id,
  title,
  sku,
  category,
  gender,
  color,
  season,
  line,
  brand_name,
  brand_id,
  tags,
  description,
  product_notes,
  material,
  srp                                            AS retail_price,
  COALESCE(wsp_usd, srp * 0.40)                 AS wholesale_price,
  srp,
  wsp_usd,
  cost,
  margin,
  moq,
  delivery_window,
  image_urls,
  CASE
    WHEN array_length(image_urls, 1) > 0 THEN image_urls[1]
    ELSE NULL
  END                                            AS image_url,
  tier_pricing,
  sizes,
  stock_total,
  CASE
    WHEN COALESCE(stock_total, 0) = 0 AND delivery_window IS NULL THEN 'Out of Stock'
    WHEN COALESCE(stock_total, 0) <= 5                            THEN 'Low Stock'
    WHEN delivery_window IS NOT NULL
         AND delivery_window NOT ILIKE '%now%'                    THEN 'Pre-Order'
    ELSE                                                               'Ready to Ship'
  END                                            AS inventory_status,
  status,
  created_at,
  updated_at,
  -- new colourway-grouping columns
  style_id,
  color_hex,
  video_urls
FROM public.inventory
WHERE status = 'active';
