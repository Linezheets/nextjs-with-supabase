-- P0 #5: One canonical vocabulary for buyer_orders.status.
--
-- The column had NO CHECK constraint, so divergent writes (notably 'preparing'
-- from the old brand "advance" button, which bypassed the canonical state
-- machine) succeeded silently. The application code now funnels all status
-- changes through lib/orders/update-status.ts; this locks the DB down too.

-- 1. Consolidate the legacy 'preparing' value into canonical 'processing'.
UPDATE public.buyer_orders SET status = 'processing' WHERE status = 'preparing';

-- 2. Enforce the canonical vocabulary on all future writes.
--    Values:
--      new                  — initial / DB default (legacy + pre-confirm)
--      confirmed            — order placed & accepted
--      processing           — being prepared (was 'preparing')
--      allocation_confirmed — forward-order allocation confirmed
--      shipped              — dispatched (tracking added)
--      delivered            — received; triggers escrow auto-release
--      cancelled            — terminal; restores stock
--      refund_approved      — dispute resolved in buyer's favour (set by disputes)
--      refunded             — Stripe refund issued (P0 #3)
--
--    Added NOT VALID: enforced for every INSERT/UPDATE from now on, but existing
--    rows are not rescanned, so the migration cannot fail on an unknown legacy
--    value. Run `ALTER TABLE public.buyer_orders VALIDATE CONSTRAINT
--    buyer_orders_status_check;` later once prod data is confirmed clean.
ALTER TABLE public.buyer_orders DROP CONSTRAINT IF EXISTS buyer_orders_status_check;
ALTER TABLE public.buyer_orders
  ADD CONSTRAINT buyer_orders_status_check
  CHECK (status IN (
    'new', 'confirmed', 'processing', 'allocation_confirmed',
    'shipped', 'delivered', 'cancelled',
    'refund_approved', 'refunded'
  )) NOT VALID;
