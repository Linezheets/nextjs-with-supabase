-- Payment terms per brand (seller configures which methods + flow they accept)
CREATE TABLE IF NOT EXISTS brand_payment_terms (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_name        text        NOT NULL UNIQUE,
  payment_methods   text[]      NOT NULL DEFAULT '{card}',
  -- 'immediate' | 'pay_later' | 'installments'
  flow              text        NOT NULL DEFAULT 'immediate',
  deadline_days     int,        -- pay_later: days until payment due after order
  installment_count int         DEFAULT 2,
  installment_days  int         DEFAULT 30,  -- days between each installment
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- One payment row per charge attempt (multiple rows per order for installments)
CREATE TABLE IF NOT EXISTS buyer_payments (
  id                          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id                    text        NOT NULL REFERENCES buyer_orders(id) ON DELETE CASCADE,
  stripe_customer_id          text,
  stripe_payment_intent_id    text,
  stripe_payment_method_id    text,       -- saved for off-session future charges
  method                      text        NOT NULL,  -- 'card' | 'ach' | 'wire'
  -- 'pending' | 'processing' | 'succeeded' | 'failed' | 'canceled'
  status                      text        NOT NULL DEFAULT 'pending',
  payment_attempt_status      text,       -- raw Stripe status for failed retry info
  amount_usd                  numeric(10,2) NOT NULL,
  installment_seq             int         NOT NULL DEFAULT 1,
  due_date                    date,
  wire_reference              text,
  bank_transfer_instructions  jsonb,      -- Stripe-provisioned bank details
  created_at                  timestamptz DEFAULT now(),
  updated_at                  timestamptz DEFAULT now()
);

-- Extend buyer_orders with payment tracking
ALTER TABLE buyer_orders
  ADD COLUMN IF NOT EXISTS payment_status     text    DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS payment_due_date   date,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_buyer_payments_order_id   ON buyer_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_buyer_payments_due_date   ON buyer_payments(due_date) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_buyer_payments_stripe_pi  ON buyer_payments(stripe_payment_intent_id);

-- RLS
ALTER TABLE brand_payment_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyer_payments       ENABLE ROW LEVEL SECURITY;

-- Buyers can read their own payments
CREATE POLICY "buyer read own payments"
  ON buyer_payments FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM buyer_orders WHERE buyer_id::uuid = auth.uid()
    )
  );

-- Service role bypasses RLS for webhook + cron writes
