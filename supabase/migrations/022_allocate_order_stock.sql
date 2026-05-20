-- ─────────────────────────────────────────────────────────────────────────────
-- allocate_order_stock_v2
--
-- Handles two fulfilment paths in one atomic transaction:
--
--   IMMEDIATE          stock is on hand → decrement inventory.sizes + stock_total
--   FUTURE_ALLOCATION  product has a delivery_window (forward / pre-order) →
--                      accepted without a stock decrement
--
-- Items with zero stock AND no delivery_window are rejected (the function
-- returns success:false and the caller gets a 409).
--
-- Called from /api/buyers/orders POST via:
--   supabase.rpc('allocate_order_stock_v2', { p_items: [...] })
--
-- p_items element shape:
-- {
--   "sku"              : "MV-SS26-001",
--   "sizes"            : { "S": 2, "M": 1 },
--   "total_qty"        : 3,
--   "delivery_window"  : "Jan–Mar 2026"   -- optional; presence triggers FUTURE path
-- }
--
-- Return shape (success):
-- {
--   "success": true,
--   "order_fulfillment_type": "IMMEDIATE" | "FUTURE_ALLOCATION" | "MIXED",
--   "allocated": [
--     {
--       "sku": "MV-SS26-001",
--       "fulfillment_type": "IMMEDIATE",
--       "sizes_used": { "S": 2, "M": 1 },
--       "stock_after": 45
--     }
--   ]
-- }
--
-- Return shape (failure):
-- {
--   "success": false,
--   "errors": [
--     { "sku": "...", "size": "S", "error": "Insufficient stock",
--       "available": 0, "requested": 2 }
--   ]
-- }
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.allocate_order_stock_v2(p_items JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item              JSONB;
  v_inv               RECORD;
  v_new_sizes         JSONB;
  v_new_stock         INTEGER;
  v_sz_key            TEXT;
  v_sz_qty            INTEGER;
  v_sz_avail          INTEGER;
  v_delivery_window   TEXT;
  v_is_future         BOOLEAN;
  v_errors            JSONB := '[]'::JSONB;
  v_allocated         JSONB := '[]'::JSONB;
  v_has_immediate     BOOLEAN := FALSE;
  v_has_future        BOOLEAN := FALSE;
  v_order_type        TEXT;
BEGIN

  -- ── Pass 1: validate every item before touching any row ───────────────────
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP

    v_delivery_window := NULLIF(TRIM(v_item->>'delivery_window'), '');
    v_is_future       := v_delivery_window IS NOT NULL;

    -- Lock the inventory row so concurrent transactions queue behind us
    SELECT id, sku, stock_total, sizes, delivery_window
      INTO v_inv
      FROM public.inventory
     WHERE sku    = v_item->>'sku'
       AND status = 'active'
       FOR UPDATE;

    IF NOT FOUND THEN
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'sku',   v_item->>'sku',
        'error', 'Product not found or inactive'
      ));
      CONTINUE;
    END IF;

    -- Inherit delivery_window from the inventory row when the caller didn't pass one
    IF NOT v_is_future AND v_inv.delivery_window IS NOT NULL AND v_inv.delivery_window <> '' THEN
      v_delivery_window := v_inv.delivery_window;
      v_is_future       := TRUE;
    END IF;

    -- FUTURE path: skip stock check — accepted as a forward order
    IF v_is_future THEN
      CONTINUE;
    END IF;

    -- IMMEDIATE path: verify per-size availability
    FOR v_sz_key, v_sz_qty IN
      SELECT key, value::text::integer
        FROM jsonb_each_text(v_item->'sizes')
       WHERE value::text::integer > 0
    LOOP
      v_sz_avail := COALESCE((v_inv.sizes ->> v_sz_key)::integer, 0);

      IF v_sz_avail < v_sz_qty THEN
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'sku',       v_item->>'sku',
          'size',      v_sz_key,
          'error',     'Insufficient stock',
          'available', v_sz_avail,
          'requested', v_sz_qty
        ));
      END IF;
    END LOOP;

  END LOOP;

  -- Bail out — nothing written if any line failed validation
  IF jsonb_array_length(v_errors) > 0 THEN
    RETURN jsonb_build_object('success', false, 'errors', v_errors);
  END IF;

  -- ── Pass 2: apply changes (all validations passed) ────────────────────────
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP

    v_delivery_window := NULLIF(TRIM(v_item->>'delivery_window'), '');
    v_is_future       := v_delivery_window IS NOT NULL;

    SELECT id, sku, stock_total, sizes, delivery_window
      INTO v_inv
      FROM public.inventory
     WHERE sku    = v_item->>'sku'
       FOR UPDATE;

    -- Re-check inherited delivery_window
    IF NOT v_is_future AND v_inv.delivery_window IS NOT NULL AND v_inv.delivery_window <> '' THEN
      v_delivery_window := v_inv.delivery_window;
      v_is_future       := TRUE;
    END IF;

    IF v_is_future THEN
      -- Future / pre-order: record allocation without touching stock
      v_has_future := TRUE;

      v_allocated := v_allocated || jsonb_build_array(jsonb_build_object(
        'sku',              v_inv.sku,
        'fulfillment_type', 'FUTURE_ALLOCATION',
        'delivery_window',  v_delivery_window,
        'sizes_used',       v_item->'sizes',
        'stock_after',      NULL
      ));

    ELSE
      -- Immediate: decrement sizes and stock_total
      v_has_immediate := TRUE;
      v_new_sizes     := v_inv.sizes;
      v_new_stock     := v_inv.stock_total;

      FOR v_sz_key, v_sz_qty IN
        SELECT key, value::text::integer
          FROM jsonb_each_text(v_item->'sizes')
         WHERE value::text::integer > 0
      LOOP
        v_new_sizes := jsonb_set(
          v_new_sizes,
          ARRAY[v_sz_key],
          to_jsonb(GREATEST(0,
            COALESCE((v_new_sizes ->> v_sz_key)::integer, 0) - v_sz_qty
          ))
        );
        v_new_stock := v_new_stock - v_sz_qty;
      END LOOP;

      UPDATE public.inventory
         SET sizes       = v_new_sizes,
             stock_total = GREATEST(0, v_new_stock)
       WHERE id = v_inv.id;

      v_allocated := v_allocated || jsonb_build_array(jsonb_build_object(
        'sku',              v_inv.sku,
        'fulfillment_type', 'IMMEDIATE',
        'sizes_used',       v_item->'sizes',
        'stock_after',      GREATEST(0, v_new_stock)
      ));

    END IF;

  END LOOP;

  -- Derive order-level fulfilment type
  v_order_type := CASE
    WHEN v_has_immediate AND v_has_future THEN 'MIXED'
    WHEN v_has_future                     THEN 'FUTURE_ALLOCATION'
    ELSE                                       'IMMEDIATE'
  END;

  RETURN jsonb_build_object(
    'success',               true,
    'order_fulfillment_type', v_order_type,
    'allocated',             v_allocated
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'errors',  jsonb_build_array(jsonb_build_object('error', SQLERRM))
  );
END;
$$;

-- Grant execute to all roles the API uses
GRANT EXECUTE ON FUNCTION public.allocate_order_stock_v2(JSONB)
  TO anon, authenticated, service_role;

-- ─── buyer_orders: add fulfillment_type column if not already present ─────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'buyer_orders'
       AND column_name  = 'fulfillment_type'
  ) THEN
    ALTER TABLE public.buyer_orders
      ADD COLUMN fulfillment_type TEXT NOT NULL DEFAULT 'IMMEDIATE';
  END IF;
END $$;
