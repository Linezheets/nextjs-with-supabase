-- Multi-currency support: EUR, GBP, USD
-- Brands price in their base currency; orders + payments carry the currency through.

-- 1. Brand storefronts: which currency the brand prices in
ALTER TABLE brand_storefronts
  ADD COLUMN IF NOT EXISTS base_currency TEXT NOT NULL DEFAULT 'USD'
    CHECK (base_currency IN ('USD','EUR','GBP'));

-- 2. buyer_payments: store the actual charge currency + amount (not just USD equivalent)
ALTER TABLE buyer_payments
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD'
    CHECK (currency IN ('USD','EUR','GBP')),
  ADD COLUMN IF NOT EXISTS amount   NUMERIC(12,2);

-- Back-fill: existing rows keep amount_usd as the authoritative figure
UPDATE buyer_payments SET amount = amount_usd WHERE amount IS NULL;

-- 3. buyer_orders: ensure currency column exists (it was defined in 007 but may be missing)
ALTER TABLE buyer_orders
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD'
    CHECK (currency IN ('USD','EUR','GBP'));

-- 4. brands table (legacy): add base_currency if that table is still used
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='brands') THEN
    EXECUTE 'ALTER TABLE brands ADD COLUMN IF NOT EXISTS base_currency TEXT NOT NULL DEFAULT ''USD'' CHECK (base_currency IN (''USD'',''EUR'',''GBP''))';
  END IF;
END $$;

COMMENT ON COLUMN brand_storefronts.base_currency IS 'Currency the brand prices their products in (USD, EUR, GBP)';
COMMENT ON COLUMN buyer_payments.currency         IS 'Stripe charge currency — matches the order currency';
COMMENT ON COLUMN buyer_payments.amount           IS 'Charge amount in the payment currency (not necessarily USD)';
COMMENT ON COLUMN buyer_orders.currency           IS 'Order currency — determined by brand base_currency at time of order';
