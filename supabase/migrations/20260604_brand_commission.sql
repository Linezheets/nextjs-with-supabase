-- Brand account type + per-brand commission rate
-- account_type: 'subscription' (tier-based fee) or 'agency_managed' (custom rate agreed with MXLLA)
ALTER TABLE brand_storefronts
  ADD COLUMN IF NOT EXISTS account_type   TEXT    NOT NULL DEFAULT 'subscription'
    CHECK (account_type IN ('subscription', 'agency_managed')),
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,4);  -- e.g. 0.0500 = 5%; NULL = use tier default

COMMENT ON COLUMN brand_storefronts.account_type IS
  'subscription = tier-based platform fee; agency_managed = custom rate agreed between MXLLA and the brand';
COMMENT ON COLUMN brand_storefronts.commission_rate IS
  'Explicit override rate (0–1). Only used when account_type = agency_managed. NULL falls back to tier default.';
