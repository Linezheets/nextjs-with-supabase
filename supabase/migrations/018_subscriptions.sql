-- Brand subscription plans and history

CREATE TABLE IF NOT EXISTS brand_subscriptions (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_user_id          UUID        NOT NULL,
  tier                   TEXT        NOT NULL DEFAULT 'starter',
  status                 TEXT        NOT NULL DEFAULT 'trialing',
  billing_cycle          TEXT        NOT NULL DEFAULT 'monthly',
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT        UNIQUE,
  current_period_start   TIMESTAMPTZ,
  current_period_end     TIMESTAMPTZ,
  cancel_at_period_end   BOOLEAN     DEFAULT FALSE,
  canceled_at            TIMESTAMPTZ,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brand_subs_user   ON brand_subscriptions(brand_user_id);
CREATE INDEX IF NOT EXISTS idx_brand_subs_stripe ON brand_subscriptions(stripe_subscription_id);

-- Subscription columns on brand_storefronts for fast reads
ALTER TABLE brand_storefronts
  ADD COLUMN IF NOT EXISTS subscription_tier        TEXT    DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS subscription_status      TEXT    DEFAULT 'trialing',
  ADD COLUMN IF NOT EXISTS stripe_customer_id       TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id   TEXT;

ALTER TABLE brand_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand read own subscription"
  ON brand_subscriptions FOR SELECT
  USING (brand_user_id = auth.uid());
