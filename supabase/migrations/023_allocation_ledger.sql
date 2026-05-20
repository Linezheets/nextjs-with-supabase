-- ─────────────────────────────────────────────────────────────────────────────
-- Market Week Allocation Ledger
--
-- Adds fulfillment_type awareness to buyer_orders and introduces
-- allocate_order_stock_v2 which distinguishes:
--
--   IMMEDIATE        — warehouse stock available; decrements inventory now
--   FUTURE_ALLOCATION — product has a delivery_window but zero/insufficient
--                       stock; accepted as a pre-order, no stock decrement
--
-- Mixed orders (some lines IMMEDIATE, some FUTURE_ALLOCATION) are supported;
-- the order row gets fulfillment_type = 'MIXED'.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── buyer_orders: add fulfillment_type column ─────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'buyer_orders' AND column_name = 'fulfillment_type'
  ) THEN
    ALTER TABLE public.buyer_orders
      ADD COLUMN fulfillment_type TEXT NOT NULL DEFAULT 'IMMEDIATE'
        CHECK (fulfillment_type IN ('IMMEDIATE', 'FUTURE_ALLOCATION', 'MIXED'));
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- allocate_order_stock_v2
--
-- p_items shape — same as v1 with one new optional field:
--   [{
--     sku             : "MV-SS26-001",
--     sizes           : {"S": 2, "M": 1},
--     total_qty       : 3,
--     delivery_window : "SS26"          -- optional; passed through from catalog
--   }]
--
-- Returns:
--   {
--     success  : true,
--     allocated: [
--       {
--         sku              : "MV-SS26-001",
--         fulfillment_type : "IMMEDIATE" | "FUTURE_ALLOCATION",
--         sizes_used       : {"S": 2, "M": 1},
--         stock_after      : 4            -- null for FUTURE_ALLOCATION
--       }
--     ],
--     order_fulfillment_type: "IMMEDIATE" | "FUTURE_ALLOCATION" | "MIXED"
--   }
--   |
--   { success: false, errors: [{sku, size?, error, available?, requested?}] }
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
  v_errors            JSONB := '[]'::JSONB;
  v_allocated         JSONB := '[]'::JSONB;
  v_item_type         TEXT;
  v_has_immediate     BOOLEAN := FALSE;
  v_has_future        BOOLEAN := FALSE;
  v_order_type        TEXT;
  v_stock_short       BOOLEAN;
BEGIN

  -- ── Pass 1: classify each item; accumulate errors only for hard failures ────
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP

    SELECT id, sku, stock_total, sizes, delivery_window
      INTO v_inv
      FROM public.inventory
     WHERE sku = v_item->>'sku'
       AND status = 'active'
       FOR UPDATE;

    IF NOT FOUND THEN
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'sku',   v_item->>'sku',
        'error', 'Product not found or inactive'
      ));
      CONTINUE;
    END IF;

    -- Check whether every requested size can be filled from current stock
    v_stock_short := FALSE;
    FOR v_sz_key, v_sz_qty IN
      SELECT key, value::text::integer
        FROM jsonb_each_text(v_item->'sizes')
       WHERE value::text::integer > 0
    LOOP
      v_sz_avail := COALESCE((v_inv.sizes ->> v_sz_key)::integer, 0);
      IF v_sz_avail < v_sz_qty THEN
        v_stock_short := TRUE;
        EXIT;
      END IF;
    END LOOP;

    IF v_stock_short THEN
      -- Can we accept this as a forward order?
      -- Either the inventory row has a delivery_window, or the caller sent one.
      IF COALESCE(v_inv.delivery_window, v_item->>'delivery_window', '') <> '' THEN
        v_item_type := 'FUTURE_ALLOCATION';
        v_has_future := TRUE;
      ELSE
        -- Hard error — no stock and no delivery window means we cannot take a pre-order
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
              'error',     'Insufficient stock — no forward delivery window set',
              'available', v_sz_avail,
              'requested', v_sz_qty
            ));
          END IF;
        END LOOP;
        CONTINUE;
      END IF;
    ELSE
      v_item_type := 'IMMEDIATE';
      v_has_immediate := TRUE;
    END IF;

  END LOOP;

  -- Bail if any item produced a hard error
  IF jsonb_array_length(v_errors) > 0 THEN
    RETURN jsonb_build_object('success', false, 'errors', v_errors);
  END IF;

  -- ── Pass 2: commit changes (IMMEDIATE items only touch stock) ───────────────
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP

    SELECT id, sku, stock_total, sizes, delivery_window
      INTO v_inv
      FROM public.inventory
     WHERE sku = v_item->>'sku'
       FOR UPDATE;

    -- Re-derive item type (same logic as pass 1)
    v_stock_short := FALSE;
    FOR v_sz_key, v_sz_qty IN
      SELECT key, value::text::integer
        FROM jsonb_each_text(v_item->'sizes')
       WHERE value::text::integer > 0
    LOOP
      v_sz_avail := COALESCE((v_inv.sizes ->> v_sz_key)::integer, 0);
      IF v_sz_avail < v_sz_qty THEN
        v_stock_short := TRUE;
        EXIT;
      END IF;
    END LOOP;

    IF v_stock_short AND COALESCE(v_inv.delivery_window, v_item->>'delivery_window', '') <> '' THEN
      -- FUTURE ALLOCATION — record without touching stock
      v_allocated := v_allocated || jsonb_build_array(jsonb_build_object(
        'sku',              v_inv.sku,
        'fulfillment_type', 'FUTURE_ALLOCATION',
        'delivery_window',  COALESCE(v_inv.delivery_window, v_item->>'delivery_window'),
        'sizes_used',       v_item->'sizes',
        'stock_after',      NULL
      ));
    ELSE
      -- IMMEDIATE — decrement stock
      v_new_sizes := v_inv.sizes;
      v_new_stock := v_inv.stock_total;

      FOR v_sz_key, v_sz_qty IN
        SELECT key, value::text::integer
          FROM jsonb_each_text(v_item->'sizes')
         WHERE value::text::integer > 0
      LOOP
        v_new_sizes := jsonb_set(
          v_new_sizes,
          ARRAY[v_sz_key],
          to_jsonb(GREATEST(0, COALESCE((v_new_sizes ->> v_sz_key)::integer, 0) - v_sz_qty))
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

  -- Derive overall order fulfillment type
  IF v_has_immediate AND v_has_future THEN
    v_order_type := 'MIXED';
  ELSIF v_has_future THEN
    v_order_type := 'FUTURE_ALLOCATION';
  ELSE
    v_order_type := 'IMMEDIATE';
  END IF;

  RETURN jsonb_build_object(
    'success',               true,
    'allocated',             v_allocated,
    'order_fulfillment_type', v_order_type
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'errors',  jsonb_build_array(jsonb_build_object('error', SQLERRM))
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.allocate_order_stock_v2(JSONB)
  TO anon, authenticated, service_role;
