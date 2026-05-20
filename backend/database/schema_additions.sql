-- ─── LINEZHEETS — PHASE 1 SCHEMA ADDITIONS ──────────────────────────────────
-- Run after schema.sql

-- ─── BUYER VERIFICATION ──────────────────────────────────────────────────────
CREATE TABLE buyer_verifications (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id             UUID REFERENCES buyers(id) ON DELETE CASCADE UNIQUE,
  tax_id               TEXT,                 -- EIN / Tax ID (stored encrypted in app layer)
  business_license_url TEXT,                 -- Supabase Storage URL
  business_type        TEXT,                 -- boutique | dept_store | online | marketplace | pop_up
  annual_revenue       TEXT,                 -- range: '<500k' | '500k-2m' | '2m-10m' | '10m+'
  years_in_business    INTEGER,
  store_count          INTEGER DEFAULT 1,
  buying_categories    TEXT[] DEFAULT '{}',  -- womenswear, menswear, etc.
  status               TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  rejection_reason     TEXT,
  reviewed_by          UUID REFERENCES users(id),
  reviewed_at          TIMESTAMPTZ,
  submitted_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_buyer_verif_status ON buyer_verifications(status);

-- ─── MOQ-BASED TIER PRICING ──────────────────────────────────────────────────
CREATE TABLE product_tier_pricing (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id    UUID REFERENCES products(id) ON DELETE CASCADE,
  tier_name     TEXT NOT NULL,       -- 'standard' | 'boutique' | 'volume' | 'vip'
  min_qty       INTEGER NOT NULL,    -- trigger quantity
  discount_pct  DECIMAL(5,2) DEFAULT 0.00, -- 0–100 off wholesale price
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, min_qty)
);

CREATE INDEX idx_tier_pricing_product ON product_tier_pricing(product_id);

-- ─── LINESHEET IMPORT JOBS ───────────────────────────────────────────────────
CREATE TABLE linesheet_imports (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id      UUID REFERENCES brands(id) ON DELETE CASCADE,
  filename      TEXT,
  status        TEXT NOT NULL DEFAULT 'processing', -- processing | done | failed
  rows_parsed   INTEGER DEFAULT 0,
  rows_created  INTEGER DEFAULT 0,
  rows_skipped  INTEGER DEFAULT 0,
  errors        JSONB DEFAULT '[]',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);

CREATE INDEX idx_linesheet_imports_brand ON linesheet_imports(brand_id, created_at DESC);

-- ─── INTEGRATION CONFIGS ─────────────────────────────────────────────────────
CREATE TABLE integration_configs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id      UUID REFERENCES brands(id) ON DELETE CASCADE,
  platform      TEXT NOT NULL, -- shopify | square | clover | quickbooks | apparelmagic
  access_token  TEXT,          -- stored encrypted
  shop_domain   TEXT,          -- e.g. my-brand.myshopify.com
  external_id   TEXT,          -- merchant/location ID on the platform
  config        JSONB DEFAULT '{}',
  active        BOOLEAN DEFAULT true,
  connected_at  TIMESTAMPTZ DEFAULT NOW(),
  last_sync_at  TIMESTAMPTZ,
  UNIQUE(brand_id, platform)
);

-- ─── ENCRYPTED CHAT ──────────────────────────────────────────────────────────
CREATE TABLE chat_rooms (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id    UUID REFERENCES brands(id) ON DELETE CASCADE,
  buyer_id    UUID REFERENCES buyers(id) ON DELETE CASCADE,
  order_id    UUID REFERENCES orders(id), -- optional: thread about a specific order
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(brand_id, buyer_id)
);

CREATE TABLE chat_messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id     UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id   UUID REFERENCES users(id),
  body        TEXT NOT NULL,         -- AES-encrypted at app layer
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_room ON chat_messages(room_id, created_at DESC);
CREATE INDEX idx_chat_rooms_brand ON chat_rooms(brand_id);
CREATE INDEX idx_chat_rooms_buyer ON chat_rooms(buyer_id);
