-- ─────────────────────────────────────────────────────────────────────────────
-- Linezheets — sell-through analysis function
-- ─────────────────────────────────────────────────────────────────────────────
-- Returns per-SKU sell-through by unnesting buyer_orders.items JSONB array
-- and joining against the inventory table.

CREATE OR REPLACE FUNCTION public.get_brand_sell_through(p_brand_name TEXT)
RETURNS TABLE (
  inventory_id   BIGINT,
  title          TEXT,
  sku            TEXT,
  category       TEXT,
  color          TEXT,
  season         TEXT,
  line           TEXT,
  stock_total    INTEGER,
  wsp_usd        NUMERIC,
  units_ordered  BIGINT,
  revenue_usd    NUMERIC,
  order_count    BIGINT,
  -- size breakdown as JSONB {S: 5, M: 12, ...}
  sizes_ordered  JSONB
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH order_items AS (
    -- Unnest items array from all orders
    SELECT
      (item ->> 'title')                        AS title,
      (item ->> 'sku')                           AS sku,
      (item ->> 'colour')                        AS colour,
      (item ->> 'brand_name')                    AS brand_name,
      COALESCE((item ->> 'qty')::int, 1)         AS qty,
      COALESCE((item ->> 'wholesale_price')::numeric, 0) AS wholesale_price,
      (item -> 'sizes')                          AS sizes_json,
      bo.id                                      AS order_id
    FROM buyer_orders bo,
         jsonb_array_elements(
           CASE jsonb_typeof(bo.items)
             WHEN 'array' THEN bo.items
             ELSE '[]'::jsonb
           END
         ) AS item
    WHERE lower(item ->> 'brand_name') = lower(p_brand_name)
  ),
  -- Explode sizes JSONB {S:2, M:3} into (size_key, qty_for_size) rows
  size_rows AS (
    SELECT
      oi.title,
      oi.sku,
      oi.colour,
      sk.key   AS size_key,
      (sk.value::text)::int AS size_qty
    FROM order_items oi,
         jsonb_each(COALESCE(oi.sizes_json, '{}'::jsonb)) sk
    WHERE oi.sizes_json IS NOT NULL
      AND jsonb_typeof(oi.sizes_json) = 'object'
  ),
  sizes_agg AS (
    SELECT
      title, sku, colour,
      jsonb_object_agg(size_key, sum_qty ORDER BY size_key) AS sizes_ordered
    FROM (
      SELECT title, sku, colour, size_key, SUM(size_qty) AS sum_qty
      FROM size_rows
      GROUP BY title, sku, colour, size_key
    ) sub
    GROUP BY title, sku, colour
  ),
  item_totals AS (
    SELECT
      title,
      sku,
      colour,
      SUM(qty)             AS units_ordered,
      SUM(qty * wholesale_price) AS revenue_usd,
      COUNT(DISTINCT order_id) AS order_count
    FROM order_items
    GROUP BY title, sku, colour
  )
  SELECT
    inv.id                                         AS inventory_id,
    inv.title,
    inv.sku,
    inv.category,
    COALESCE(it.colour, inv.color, '')             AS color,
    inv.season,
    inv.line,
    COALESCE(inv.stock_total, 0)                   AS stock_total,
    COALESCE(inv.wsp_usd, 0)                       AS wsp_usd,
    COALESCE(it.units_ordered, 0)                  AS units_ordered,
    COALESCE(it.revenue_usd, 0)                    AS revenue_usd,
    COALESCE(it.order_count, 0)                    AS order_count,
    COALESCE(sa.sizes_ordered, '{}'::jsonb)        AS sizes_ordered
  FROM inventory inv
  LEFT JOIN item_totals it
         ON lower(it.title) = lower(inv.title)
  LEFT JOIN sizes_agg sa
         ON lower(sa.title) = lower(inv.title)
  WHERE lower(inv.brand_name) = lower(p_brand_name)
    AND inv.status != 'archived'
  ORDER BY it.units_ordered DESC NULLS LAST, inv.title;
$$;

GRANT EXECUTE ON FUNCTION public.get_brand_sell_through(TEXT) TO authenticated;
