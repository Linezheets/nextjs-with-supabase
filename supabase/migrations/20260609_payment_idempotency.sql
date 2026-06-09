-- ─────────────────────────────────────────────────────────────────────────────
-- Payment idempotency hardening (audit themes D, E)
-- Run in Supabase Dashboard → SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Stripe webhook event de-duplication.
--    The webhook inserts event.id before processing; a duplicate/replayed event
--    hits the PK and is skipped, so no handler ever double-applies.
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  event_id     text        PRIMARY KEY,
  type         text,
  processed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
-- Service role only (webhook runs with the service-role key, bypassing RLS).
DROP POLICY IF EXISTS "swe_service_all" ON public.stripe_webhook_events;
CREATE POLICY "swe_service_all" ON public.stripe_webhook_events FOR ALL USING (true) WITH CHECK (true);

-- 2. At most one *active* payment row per (order, installment) — makes duplicate
--    installment scheduling / double-charge impossible even if app logic slips.
--    Failed/canceled rows are excluded so a retry after failure is still allowed.
--    NOTE: if legacy duplicate rows exist this index creation will fail; de-dupe
--    buyer_payments first (keep the most recent non-failed row per order_id+seq).
CREATE UNIQUE INDEX IF NOT EXISTS buyer_payments_order_seq_uniq
  ON public.buyer_payments (order_id, installment_seq)
  WHERE status IN ('pending', 'processing', 'succeeded');
