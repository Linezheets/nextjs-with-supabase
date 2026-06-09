-- ─────────────────────────────────────────────────────────────────────────────
-- Atomic escrow release (audit theme D)
-- Adds a 'releasing' claim state so concurrent release attempts serialize and
-- can never create two Stripe transfers for one order.
-- Run in Supabase Dashboard → SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.buyer_orders DROP CONSTRAINT IF EXISTS buyer_orders_escrow_status_check;
ALTER TABLE public.buyer_orders
  ADD CONSTRAINT buyer_orders_escrow_status_check
  CHECK (escrow_status IN ('held', 'releasing', 'released', 'not_applicable'));

COMMENT ON COLUMN public.buyer_orders.escrow_status IS
  'held = funds in platform account; releasing = transfer in progress (claimed); released = transferred to brand; not_applicable = no Stripe payment';
