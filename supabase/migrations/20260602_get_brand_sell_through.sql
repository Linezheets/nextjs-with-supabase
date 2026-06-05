-- RPC: get_brand_sell_through
-- Returns per-SKU sell-through data for a brand by joining inventory with
-- buyer_orders JSONB items.  The API route falls back to JS aggregation when
-- this function is absent; deploying this migration removes the fallback path.
--
-- Parameters
--   p_brand_name  exact brand name stored in inventory.brand_name / items[].brand_name
--   p_since       optional lower-bound on order created_at (ISO timestamptz)

-- Drop the old single-arg overload from 019_sell_through.sql so we don't have
-- two ambiguous signatures.
DROP FUNCTION IF EXISTS public.get_brand_sell_through(text);

CREATE OR REPLACE FUNCTION get_brand_sell_through(
  p_brand_name text,
  p_since      timestamptz DEFAULT NULL
)
RETURNS TABLE (
  inventory_id  int,
  title         text,
  sku           text,
  category      text,
  color         text,
  season        text,
  line          text,
  stock_total   int,
  wsp_usd       numeric,
  units_ordered int,
  revenue_usd   numeric,
  order_count   int,
  sizes_ordered jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Unnest each order's items array, keeping only items for this brand
  WITH order_items AS (
    SELECT
      o.id   AS order_id,
      item
    FROM buyer_orders o,
         jsonb_array_elements(o.items) AS item
    WHERE (p_since IS NULL OR o.created_at >= p_since)
      AND lower(item->>'brand_name') = lower(p_brand_name)
  ),

  -- Sum qty per size per title
  size_agg AS (
    SELECT
      lower(oi.item->>'title')         AS title_key,
      sz.key                           AS size,
      sum((sz.value #>> '{}')::numeric)::int AS qty
    FROM order_items oi,
         jsonb_each(COALESCE(oi.item->'sizes', '{}'::jsonb)) AS sz
    GROUP BY lower(oi.item->>'title'), sz.key
  ),

  -- Rebuild sizes as a single jsonb object per title
  sizes_per_title AS (
    SELECT
      title_key,
      jsonb_object_agg(size, qty) AS sizes_ordered
    FROM size_agg
    GROUP BY title_key
  ),

  -- Aggregate units, revenue, and distinct order count per title
  item_agg AS (
    SELECT
      lower(item->>'title')                                          AS title_key,
      sum(COALESCE((item->>'qty')::int, 1))::int                    AS units_ordered,
      sum(
        COALESCE((item->>'wholesale_price')::numeric, 0) *
        COALESCE((item->>'qty')::int, 1)
      )                                                              AS revenue_usd,
      count(DISTINCT order_id)::int                                  AS order_count
    FROM order_items
    GROUP BY lower(item->>'title')
  )

  SELECT
    inv.id::int                             AS inventory_id,
    inv.title::text                         AS title,
    inv.sku::text                           AS sku,
    inv.category::text                      AS category,
    inv.color::text                         AS color,
    inv.season::text                        AS season,
    inv.line::text                          AS line,
    COALESCE(inv.stock_total, 0)::int       AS stock_total,
    COALESCE(inv.wsp_usd, 0)::numeric       AS wsp_usd,
    COALESCE(a.units_ordered, 0)            AS units_ordered,
    COALESCE(a.revenue_usd, 0)::numeric     AS revenue_usd,
    COALESCE(a.order_count, 0)              AS order_count,
    COALESCE(s.sizes_ordered, '{}'::jsonb)  AS sizes_ordered
  FROM inventory inv
  LEFT JOIN item_agg        a ON a.title_key = lower(inv.title)
  LEFT JOIN sizes_per_title s ON s.title_key = lower(inv.title)
  WHERE inv.brand_name = p_brand_name
    AND inv.status IS DISTINCT FROM 'archived'
  ORDER BY inv.title;
$$;

-- Allow authenticated users (brand owners) to call this via the API route
GRANT EXECUTE ON FUNCTION get_brand_sell_through(text, timestamptz) TO authenticated;
