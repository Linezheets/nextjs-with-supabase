-- ─── Buyer Orders ─────────────────────────────────────────────────────────────
-- Lightweight order table for the buyer-shop / brand-admin flow.
-- Stores items as JSONB so the order is self-contained (no FK to product_variants).

CREATE TABLE IF NOT EXISTS buyer_orders (
  id           TEXT PRIMARY KEY,              -- e.g. LZ-1716000000000
  buyer_id     UUID,                          -- from buyers.id (soft ref — no FK constraint so orders survive buyer deletes)
  buyer_name   TEXT,
  brand_id     UUID,                          -- optional: which brand the order is for
  status       TEXT NOT NULL DEFAULT 'new',
  total_usd    DECIMAL(14,2) NOT NULL DEFAULT 0,
  currency     TEXT DEFAULT 'USD',
  terms        TEXT,
  notes        TEXT,
  items        JSONB DEFAULT '[]',            -- raw cart items snapshot
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buyer_orders_buyer_id   ON buyer_orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_buyer_orders_brand_id   ON buyer_orders(brand_id);
CREATE INDEX IF NOT EXISTS idx_buyer_orders_status     ON buyer_orders(status);
CREATE INDEX IF NOT EXISTS idx_buyer_orders_created_at ON buyer_orders(created_at DESC);
