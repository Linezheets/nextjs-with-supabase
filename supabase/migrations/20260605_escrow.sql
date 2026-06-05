-- Payment escrow: funds held in platform Stripe account until order is fulfilled.
-- Released explicitly via /api/payments/release/[orderId] (auto-triggered on delivery).

-- buyer_orders: track escrow lifecycle
ALTER TABLE buyer_orders
  ADD COLUMN IF NOT EXISTS escrow_status      TEXT NOT NULL DEFAULT 'held'
    CHECK (escrow_status IN ('held', 'released', 'not_applicable')),
  ADD COLUMN IF NOT EXISTS escrow_released_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_transfer_id TEXT;  -- populated when funds are released

-- buyer_payments: link each payment to its Stripe transfer group + eventual transfer ID
ALTER TABLE buyer_payments
  ADD COLUMN IF NOT EXISTS transfer_group    TEXT,   -- = order_id (groups all PIs for an order)
  ADD COLUMN IF NOT EXISTS stripe_transfer_id TEXT;  -- populated when this installment's funds are released

COMMENT ON COLUMN buyer_orders.escrow_status      IS 'held = funds in platform account; released = transferred to brand; not_applicable = no Stripe payment';
COMMENT ON COLUMN buyer_orders.stripe_transfer_id IS 'Stripe transfer ID created when escrow is released to the brand';
COMMENT ON COLUMN buyer_payments.transfer_group   IS 'Stripe transfer_group param — equals order_id, links all PIs for the same order';
COMMENT ON COLUMN buyer_payments.stripe_transfer_id IS 'Stripe transfer ID for this specific installment payment';
