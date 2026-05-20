-- ============================================================
-- LINEZHEETS PLATFORM — COMPLETE DATABASE SCHEMA
-- Run this in Supabase SQL Editor (or any PostgreSQL instance)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── ENUMS ──────────────────────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM ('admin', 'brand', 'buyer');
CREATE TYPE subscription_tier AS ENUM ('starter', 'studio', 'enterprise');
CREATE TYPE subscription_status AS ENUM ('active', 'trialing', 'past_due', 'canceled', 'paused');
CREATE TYPE product_status AS ENUM ('draft', 'active', 'archived');
CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded');
CREATE TYPE payment_status AS ENUM ('pending', 'processing', 'paid', 'failed', 'refunded', 'partially_refunded');
CREATE TYPE installment_status AS ENUM ('scheduled', 'paid', 'overdue', 'waived');
CREATE TYPE brand_status AS ENUM ('pending', 'approved', 'suspended');
CREATE TYPE buyer_status AS ENUM ('pending', 'verified', 'suspended');

-- ─── USERS ──────────────────────────────────────────────────────────────────

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email           TEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  role            user_role NOT NULL DEFAULT 'buyer',
  first_name      TEXT,
  last_name       TEXT,
  phone           TEXT,
  avatar_url      TEXT,
  email_verified  BOOLEAN DEFAULT false,
  verify_token    TEXT,
  reset_token     TEXT,
  reset_expires   TIMESTAMPTZ,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ─── BRANDS ─────────────────────────────────────────────────────────────────

CREATE TABLE brands (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID REFERENCES users(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  slug                  TEXT UNIQUE NOT NULL,
  description           TEXT,
  story                 TEXT,
  logo_url              TEXT,
  banner_url            TEXT,
  website               TEXT,
  instagram             TEXT,
  founded_year          INTEGER,
  country               TEXT DEFAULT 'US',
  currency              TEXT DEFAULT 'USD',
  status                brand_status DEFAULT 'pending',
  featured              BOOLEAN DEFAULT false,
  -- Stripe Connect
  stripe_account_id     TEXT UNIQUE,
  stripe_account_status TEXT DEFAULT 'not_connected',
  -- Subscription
  subscription_tier     subscription_tier DEFAULT 'starter',
  subscription_status   subscription_status DEFAULT 'trialing',
  stripe_subscription_id TEXT,
  stripe_customer_id    TEXT,
  trial_ends_at         TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
  -- Commission rate platform takes (percentage, e.g. 3.0 = 3%)
  commission_rate       DECIMAL(5,2) DEFAULT 3.00,
  -- Settings
  min_order_amount      DECIMAL(12,2) DEFAULT 500.00,
  max_order_amount      DECIMAL(12,2) DEFAULT 500000.00,
  payment_terms_days    INTEGER DEFAULT 30,
  allow_installments    BOOLEAN DEFAULT true,
  -- Metadata
  total_products        INTEGER DEFAULT 0,
  total_orders          INTEGER DEFAULT 0,
  total_revenue         DECIMAL(14,2) DEFAULT 0.00,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_brands_user_id ON brands(user_id);
CREATE INDEX idx_brands_slug ON brands(slug);
CREATE INDEX idx_brands_status ON brands(status);
CREATE INDEX idx_brands_featured ON brands(featured);

-- ─── BRAND STORE SETTINGS ───────────────────────────────────────────────────

CREATE TABLE brand_stores (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id        UUID REFERENCES brands(id) ON DELETE CASCADE,
  -- Theming
  primary_color   TEXT DEFAULT '#C9A84C',
  accent_color    TEXT DEFAULT '#8B1A2F',
  bg_color        TEXT DEFAULT '#0A0A0F',
  font_heading    TEXT DEFAULT 'Cormorant Garamond',
  font_body       TEXT DEFAULT 'Inter',
  -- Layout
  hero_layout     TEXT DEFAULT 'centered', -- centered | split | fullbleed
  grid_columns    INTEGER DEFAULT 4,
  show_prices     BOOLEAN DEFAULT true,
  show_inventory  BOOLEAN DEFAULT false,
  -- SEO
  meta_title      TEXT,
  meta_description TEXT,
  -- Custom domain
  custom_domain   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PRODUCT CATEGORIES ─────────────────────────────────────────────────────

CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  parent_id   UUID REFERENCES categories(id),
  sort_order  INTEGER DEFAULT 0
);

INSERT INTO categories (name, slug) VALUES
  ('Womenswear', 'womenswear'),
  ('Menswear', 'menswear'),
  ('Accessories', 'accessories'),
  ('Footwear', 'footwear'),
  ('Luxury', 'luxury'),
  ('Contemporary', 'contemporary'),
  ('Denim', 'denim'),
  ('Activewear', 'activewear'),
  ('Outerwear', 'outerwear'),
  ('Bridal', 'bridal');

-- ─── PRODUCTS ───────────────────────────────────────────────────────────────

CREATE TABLE products (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id            UUID REFERENCES brands(id) ON DELETE CASCADE,
  category_id         UUID REFERENCES categories(id),
  -- Core info
  name                TEXT NOT NULL,
  slug                TEXT NOT NULL,
  description         TEXT,
  story               TEXT,
  care_instructions   TEXT,
  -- Pricing (wholesale)
  wholesale_price     DECIMAL(12,2) NOT NULL,
  retail_price        DECIMAL(12,2),   -- suggested retail
  msrp                DECIMAL(12,2),   -- MSRP / SRP
  -- Codes
  sku_prefix          TEXT,
  style_number        TEXT,
  -- Media
  images              TEXT[] DEFAULT '{}',   -- array of URLs
  video_url           TEXT,
  -- Season / delivery
  season              TEXT,       -- SS26, FW25, etc.
  delivery_window     TEXT,       -- Jan–Mar 2026
  -- Minimums
  min_order_qty       INTEGER DEFAULT 1,
  min_order_value     DECIMAL(12,2),
  -- Tags for AI matching
  tags                TEXT[] DEFAULT '{}',
  style_dna           JSONB DEFAULT '{}',   -- {aesthetic: [], mood: [], palette: []}
  -- Status
  status              product_status DEFAULT 'draft',
  featured            BOOLEAN DEFAULT false,
  -- Stats
  total_sold          INTEGER DEFAULT 0,
  total_views         INTEGER DEFAULT 0,
  avg_rating          DECIMAL(3,2) DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(brand_id, slug)
);

CREATE INDEX idx_products_brand_id ON products(brand_id);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_season ON products(season);
CREATE INDEX idx_products_wholesale_price ON products(wholesale_price);

-- ─── PRODUCT VARIANTS ───────────────────────────────────────────────────────

CREATE TABLE product_variants (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id      UUID REFERENCES products(id) ON DELETE CASCADE,
  -- Attributes
  size            TEXT,
  color           TEXT,
  color_hex       TEXT,
  material        TEXT,
  sku             TEXT UNIQUE NOT NULL,
  barcode         TEXT,
  -- Pricing override (NULL = use product price)
  wholesale_price DECIMAL(12,2),
  -- Stock
  quantity        INTEGER NOT NULL DEFAULT 0,
  reserved_qty    INTEGER DEFAULT 0,  -- reserved in pending orders
  reorder_point   INTEGER DEFAULT 5,
  -- Location
  warehouse       TEXT DEFAULT 'primary',
  bin_location    TEXT,
  -- Status
  active          BOOLEAN DEFAULT true,
  image_url       TEXT,
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_variants_product_id ON product_variants(product_id);
CREATE INDEX idx_variants_sku ON product_variants(sku);

-- Available stock view
CREATE VIEW variant_available_stock AS
SELECT id, product_id, sku, size, color, quantity, reserved_qty,
       GREATEST(0, quantity - reserved_qty) AS available_qty
FROM product_variants
WHERE active = true;

-- ─── BUYERS ─────────────────────────────────────────────────────────────────

CREATE TABLE buyers (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID REFERENCES users(id) ON DELETE CASCADE,
  -- Business info
  company_name      TEXT NOT NULL,
  business_type     TEXT,  -- boutique | department_store | online_retailer | etc.
  ein               TEXT,  -- tax ID
  website           TEXT,
  instagram         TEXT,
  -- Address
  billing_address   JSONB DEFAULT '{}',
  shipping_address  JSONB DEFAULT '{}',
  -- Credit / limits
  credit_limit      DECIMAL(14,2) DEFAULT 0.00,
  credit_used       DECIMAL(14,2) DEFAULT 0.00,
  payment_terms     INTEGER DEFAULT 30,  -- days
  allow_installments BOOLEAN DEFAULT true,
  max_installments  INTEGER DEFAULT 6,
  -- Stripe
  stripe_customer_id TEXT,
  -- Status
  status            buyer_status DEFAULT 'pending',
  verified_at       TIMESTAMPTZ,
  -- AI profile
  style_preferences TEXT[] DEFAULT '{}',
  price_range_min   DECIMAL(12,2),
  price_range_max   DECIMAL(12,2),
  -- Stats
  total_orders      INTEGER DEFAULT 0,
  total_spent       DECIMAL(14,2) DEFAULT 0.00,
  avg_order_value   DECIMAL(12,2) DEFAULT 0.00,
  payment_score     INTEGER DEFAULT 100, -- 0-100 reliability score
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_buyers_user_id ON buyers(user_id);
CREATE INDEX idx_buyers_status ON buyers(status);

-- ─── ORDERS ─────────────────────────────────────────────────────────────────

CREATE TABLE orders (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number          TEXT UNIQUE NOT NULL,  -- LZ-2026-000001
  buyer_id              UUID REFERENCES buyers(id),
  brand_id              UUID REFERENCES brands(id),
  -- Totals
  subtotal              DECIMAL(14,2) NOT NULL DEFAULT 0,
  discount_amount       DECIMAL(14,2) DEFAULT 0,
  shipping_amount       DECIMAL(14,2) DEFAULT 0,
  tax_amount            DECIMAL(14,2) DEFAULT 0,
  total_amount          DECIMAL(14,2) NOT NULL,
  currency              TEXT DEFAULT 'USD',
  -- Platform commission
  platform_commission   DECIMAL(14,2) DEFAULT 0,
  brand_payout          DECIMAL(14,2) DEFAULT 0,
  -- Status
  status                order_status DEFAULT 'pending',
  payment_status        payment_status DEFAULT 'pending',
  -- Addresses
  shipping_address      JSONB DEFAULT '{}',
  billing_address       JSONB DEFAULT '{}',
  -- Shipping
  shipping_method       TEXT,
  tracking_number       TEXT,
  shipped_at            TIMESTAMPTZ,
  delivered_at          TIMESTAMPTZ,
  estimated_delivery    DATE,
  -- Payment method
  payment_method        TEXT DEFAULT 'card',  -- card | installment | net30 | wire
  -- Installment plan reference
  installment_plan_id   UUID,
  -- Notes
  buyer_notes           TEXT,
  internal_notes        TEXT,
  -- Timestamps
  confirmed_at          TIMESTAMPTZ,
  cancelled_at          TIMESTAMPTZ,
  cancel_reason         TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_buyer_id ON orders(buyer_id);
CREATE INDEX idx_orders_brand_id ON orders(brand_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- Auto-generate order numbers
CREATE SEQUENCE order_number_seq START 1000;
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.order_number := 'LZ-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('order_number_seq')::TEXT, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION generate_order_number();

-- ─── ORDER ITEMS ────────────────────────────────────────────────────────────

CREATE TABLE order_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES products(id),
  variant_id      UUID REFERENCES product_variants(id),
  -- Snapshot at order time
  product_name    TEXT NOT NULL,
  variant_sku     TEXT NOT NULL,
  size            TEXT,
  color           TEXT,
  image_url       TEXT,
  -- Pricing
  unit_price      DECIMAL(12,2) NOT NULL,
  quantity        INTEGER NOT NULL,
  line_total      DECIMAL(14,2) NOT NULL,
  -- Status
  fulfilled       BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
CREATE INDEX idx_order_items_variant_id ON order_items(variant_id);

-- ─── INSTALLMENT PLANS ──────────────────────────────────────────────────────

CREATE TABLE installment_plans (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id              UUID REFERENCES orders(id),
  buyer_id              UUID REFERENCES buyers(id),
  -- Plan details
  plan_type             TEXT NOT NULL,  -- '3month' | '6month' | '12month' | 'custom' | 'net30' | 'deposit_balance'
  total_amount          DECIMAL(14,2) NOT NULL,
  paid_amount           DECIMAL(14,2) DEFAULT 0,
  remaining_amount      DECIMAL(14,2),
  installment_count     INTEGER NOT NULL,
  installments_paid     INTEGER DEFAULT 0,
  -- Stripe
  stripe_setup_intent   TEXT,
  stripe_payment_method TEXT,
  -- Status
  status                TEXT DEFAULT 'active',  -- active | completed | defaulted | cancelled
  -- Interest/fees
  interest_rate         DECIMAL(5,4) DEFAULT 0,  -- 0 = interest free
  setup_fee             DECIMAL(12,2) DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Installment schedule
CREATE TABLE installment_payments (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id               UUID REFERENCES installment_plans(id) ON DELETE CASCADE,
  installment_number    INTEGER NOT NULL,
  due_date              DATE NOT NULL,
  amount                DECIMAL(14,2) NOT NULL,
  -- Payment
  stripe_payment_intent TEXT,
  stripe_charge_id      TEXT,
  paid_at               TIMESTAMPTZ,
  paid_amount           DECIMAL(14,2),
  -- Status
  status                installment_status DEFAULT 'scheduled',
  -- Retry
  retry_count           INTEGER DEFAULT 0,
  last_attempt_at       TIMESTAMPTZ,
  failure_reason        TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_installment_payments_plan_id ON installment_payments(plan_id);
CREATE INDEX idx_installment_payments_due_date ON installment_payments(due_date);
CREATE INDEX idx_installment_payments_status ON installment_payments(status);

-- ─── TRANSACTIONS (full payment ledger) ─────────────────────────────────────

CREATE TABLE transactions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id              UUID REFERENCES orders(id),
  buyer_id              UUID REFERENCES buyers(id),
  brand_id              UUID REFERENCES brands(id),
  installment_payment_id UUID REFERENCES installment_payments(id),
  -- Stripe data
  stripe_payment_intent TEXT UNIQUE,
  stripe_charge_id      TEXT,
  stripe_transfer_id    TEXT,  -- transfer to brand's Connect account
  -- Amounts
  amount                DECIMAL(14,2) NOT NULL,
  currency              TEXT DEFAULT 'USD',
  platform_fee          DECIMAL(14,2) DEFAULT 0,
  brand_amount          DECIMAL(14,2) DEFAULT 0,
  -- Status
  status                payment_status DEFAULT 'pending',
  type                  TEXT DEFAULT 'charge',  -- charge | refund | transfer | payout
  -- Metadata
  description           TEXT,
  metadata              JSONB DEFAULT '{}',
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_order_id ON transactions(order_id);
CREATE INDEX idx_transactions_brand_id ON transactions(brand_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);

-- ─── SUBSCRIPTIONS (brand monthly plans) ────────────────────────────────────

CREATE TABLE brand_subscriptions (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id                UUID REFERENCES brands(id) ON DELETE CASCADE,
  stripe_subscription_id  TEXT UNIQUE,
  stripe_customer_id      TEXT,
  tier                    subscription_tier NOT NULL,
  status                  subscription_status DEFAULT 'trialing',
  -- Billing
  monthly_price           DECIMAL(10,2),
  billing_cycle           TEXT DEFAULT 'monthly',  -- monthly | annual
  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  cancel_at_period_end    BOOLEAN DEFAULT false,
  cancelled_at            TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ─── INVENTORY SYNC LOG ──────────────────────────────────────────────────────

CREATE TABLE inventory_sync_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id        UUID REFERENCES brands(id),
  variant_id      UUID REFERENCES product_variants(id),
  source          TEXT,  -- shopify | netsuite | manual | api | order
  change_type     TEXT,  -- add | subtract | set | reserve | release
  qty_before      INTEGER,
  qty_change      INTEGER,
  qty_after       INTEGER,
  reference_id    TEXT,  -- order_id or external ref
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inventory_log_brand_id ON inventory_sync_log(brand_id);
CREATE INDEX idx_inventory_log_variant_id ON inventory_sync_log(variant_id);

-- ─── REVIEWS ────────────────────────────────────────────────────────────────

CREATE TABLE product_reviews (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id  UUID REFERENCES products(id) ON DELETE CASCADE,
  buyer_id    UUID REFERENCES buyers(id),
  order_id    UUID REFERENCES orders(id),
  rating      INTEGER CHECK (rating BETWEEN 1 AND 5),
  title       TEXT,
  body        TEXT,
  verified    BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── WISHLIST / SAVED ITEMS ──────────────────────────────────────────────────

CREATE TABLE saved_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id    UUID REFERENCES buyers(id) ON DELETE CASCADE,
  product_id  UUID REFERENCES products(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(buyer_id, product_id)
);

-- ─── CART ───────────────────────────────────────────────────────────────────

CREATE TABLE cart_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id    UUID REFERENCES buyers(id) ON DELETE CASCADE,
  product_id  UUID REFERENCES products(id) ON DELETE CASCADE,
  variant_id  UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity    INTEGER NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(buyer_id, variant_id)
);

-- ─── BRAND FOLLOWERS ────────────────────────────────────────────────────────

CREATE TABLE brand_follows (
  buyer_id    UUID REFERENCES buyers(id) ON DELETE CASCADE,
  brand_id    UUID REFERENCES brands(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (buyer_id, brand_id)
);

-- ─── AI MATCH SCORES ────────────────────────────────────────────────────────

CREATE TABLE ai_match_scores (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id    UUID REFERENCES brands(id) ON DELETE CASCADE,
  buyer_id    UUID REFERENCES buyers(id) ON DELETE CASCADE,
  score       INTEGER CHECK (score BETWEEN 0 AND 100),
  factors     JSONB DEFAULT '{}',
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(brand_id, buyer_id)
);

-- ─── NOTIFICATIONS ───────────────────────────────────────────────────────────

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT,
  link        TEXT,
  read        BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);

-- ─── HELPER FUNCTIONS ────────────────────────────────────────────────────────

-- Updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON brands FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON product_variants FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON buyers FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Reserve stock when order is placed
CREATE OR REPLACE FUNCTION reserve_stock(v_variant_id UUID, v_qty INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  avail INTEGER;
BEGIN
  SELECT GREATEST(0, quantity - reserved_qty) INTO avail
  FROM product_variants WHERE id = v_variant_id FOR UPDATE;
  IF avail < v_qty THEN RETURN false; END IF;
  UPDATE product_variants SET reserved_qty = reserved_qty + v_qty WHERE id = v_variant_id;
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Commit stock (when order ships)
CREATE OR REPLACE FUNCTION commit_stock(v_variant_id UUID, v_qty INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE product_variants
  SET quantity = quantity - v_qty,
      reserved_qty = GREATEST(0, reserved_qty - v_qty)
  WHERE id = v_variant_id;
END;
$$ LANGUAGE plpgsql;

-- Release reserved stock (when order cancelled)
CREATE OR REPLACE FUNCTION release_stock(v_variant_id UUID, v_qty INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE product_variants
  SET reserved_qty = GREATEST(0, reserved_qty - v_qty)
  WHERE id = v_variant_id;
END;
$$ LANGUAGE plpgsql;

-- Dashboard summary views
CREATE VIEW brand_dashboard_summary AS
SELECT
  b.id AS brand_id,
  b.name,
  b.subscription_tier,
  b.subscription_status,
  COUNT(DISTINCT p.id) AS product_count,
  COUNT(DISTINCT o.id) AS order_count,
  COALESCE(SUM(o.total_amount) FILTER (WHERE o.payment_status = 'paid'), 0) AS revenue_collected,
  COALESCE(SUM(o.total_amount) FILTER (WHERE o.payment_status = 'pending'), 0) AS revenue_pending,
  COUNT(DISTINCT o.buyer_id) AS unique_buyers
FROM brands b
LEFT JOIN products p ON p.brand_id = b.id AND p.status = 'active'
LEFT JOIN orders o ON o.brand_id = b.id AND o.status NOT IN ('cancelled','refunded')
GROUP BY b.id, b.name, b.subscription_tier, b.subscription_status;

CREATE VIEW buyer_dashboard_summary AS
SELECT
  buy.id AS buyer_id,
  buy.company_name,
  COUNT(DISTINCT o.id) AS order_count,
  COALESCE(SUM(o.total_amount), 0) AS total_spent,
  COUNT(DISTINCT o.brand_id) AS brands_ordered_from,
  COUNT(DISTINCT ip.id) FILTER (WHERE ip.status = 'active') AS active_installment_plans
FROM buyers buy
LEFT JOIN orders o ON o.buyer_id = buy.id AND o.status NOT IN ('cancelled','refunded')
LEFT JOIN installment_plans ip ON ip.buyer_id = buy.id
GROUP BY buy.id, buy.company_name;
