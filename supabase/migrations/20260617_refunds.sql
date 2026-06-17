-- P0 #3: Persist Stripe refunds.
--
-- There was nowhere to record a refund, and no code ever called
-- stripe.refunds.create — dispute "refunds" only reversed the brand transfer,
-- leaving the buyer's money-back a manual Stripe-dashboard task.

-- Order-level refund tracking.
ALTER TABLE public.buyer_orders
  ADD COLUMN IF NOT EXISTS refund_status       TEXT,                       -- null | partially_refunded | refunded
  ADD COLUMN IF NOT EXISTS refunded_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refunded_amount_usd NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Per-payment refund tracking (one buyer_payments row per charge/installment).
ALTER TABLE public.buyer_payments
  ADD COLUMN IF NOT EXISTS stripe_refund_id    TEXT,
  ADD COLUMN IF NOT EXISTS refunded_amount_usd NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Add a terminal 'refunded' escrow state. A refunded order must never be
-- (re)released to the brand: the atomic release claim in releaseEscrow only
-- matches escrow_status in ('held','releasing'), so 'refunded' is non-releasable
-- by construction, and releaseEscrow also guards on it explicitly.
ALTER TABLE public.buyer_orders DROP CONSTRAINT IF EXISTS buyer_orders_escrow_status_check;
ALTER TABLE public.buyer_orders
  ADD CONSTRAINT buyer_orders_escrow_status_check
  CHECK (escrow_status IN ('held', 'releasing', 'released', 'not_applicable', 'refunded'));
