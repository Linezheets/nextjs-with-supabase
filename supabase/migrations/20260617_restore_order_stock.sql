-- P0 #4: Restore inventory when an order is cancelled or refunded.
--
-- allocate_order_stock_v2 only ever DECREMENTS stock. There was no inverse, so
-- cancelled/refunded immediate orders leaked their allocated units permanently.
--
-- restore_order_stock(order_id) is the exact inverse: it re-reads the order's
-- stored line items (which carry per-size `sizes` and per-line `fulfillment_type`)
-- and increments inventory for IMMEDIATE lines only — FUTURE_ALLOCATION lines
-- never decremented, so they must NOT be incremented. Locks each inventory row
-- FOR UPDATE to serialise with allocation. Idempotent via stock_restored_at.

-- Guard column: set once on a successful restore so it can never run twice.
ALTER TABLE public.buyer_orders
  ADD COLUMN IF NOT EXISTS stock_restored_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.restore_order_stock(p_order_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order      RECORD;
  v_inv        RECORD;
  v_item       JSONB;
  v_ftype      TEXT;
  v_new_sizes  JSONB;
  v_new_stock  INTEGER;
  v_sz_key     TEXT;
  v_sz_qty     INTEGER;
  v_restored   JSONB := '[]'::JSONB;
BEGIN
  SELECT id, items, stock_restored_at
    INTO v_order
    FROM public.buyer_orders
   WHERE id = p_order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- Idempotent — never restore the same order twice.
  IF v_order.stock_restored_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'already restored');
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(v_order.items, '[]'::JSONB)) LOOP
    v_ftype := COALESCE(v_item->>'fulfillment_type', 'IMMEDIATE');
    -- Only IMMEDIATE lines decremented stock at allocation; skip pre-orders.
    IF v_ftype <> 'IMMEDIATE' THEN
      CONTINUE;
    END IF;

    SELECT id, sizes, stock_total
      INTO v_inv
      FROM public.inventory
     WHERE sku = v_item->>'sku'
     FOR UPDATE;

    -- SKU may have been deleted since the order was placed — skip silently.
    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    v_new_sizes := COALESCE(v_inv.sizes, '{}'::JSONB);
    v_new_stock := COALESCE(v_inv.stock_total, 0);

    FOR v_sz_key, v_sz_qty IN
      SELECT key, value::text::integer
        FROM jsonb_each_text(v_item->'sizes')
       WHERE value::text::integer > 0
    LOOP
      v_new_sizes := jsonb_set(
        v_new_sizes,
        ARRAY[v_sz_key],
        to_jsonb(COALESCE((v_new_sizes ->> v_sz_key)::integer, 0) + v_sz_qty)
      );
      v_new_stock := v_new_stock + v_sz_qty;
    END LOOP;

    UPDATE public.inventory
       SET sizes       = v_new_sizes,
           stock_total = v_new_stock
     WHERE id = v_inv.id;

    v_restored := v_restored || jsonb_build_array(jsonb_build_object(
      'sku',            v_item->>'sku',
      'sizes_restored', v_item->'sizes'
    ));
  END LOOP;

  UPDATE public.buyer_orders
     SET stock_restored_at = now()
   WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'restored', v_restored);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.restore_order_stock(TEXT)
  TO service_role;
