-- ══════════════════════════════════════════════════════════════════════════════
-- LINEZHEETS PLATFORM — CONSOLIDATED SCHEMA STACK
-- Single-file, fully idempotent. Safe to run on a fresh or existing database.
-- Tables are created with their final canonical schema; DO blocks handle
-- existing databases that ran the incremental migrations.
-- ══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- 0. UTILITY FUNCTION
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. INVENTORY
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.inventory (
  id               BIGSERIAL      PRIMARY KEY,
  title            TEXT           NOT NULL DEFAULT '',
  sku              TEXT           UNIQUE,
  category         TEXT           NOT NULL DEFAULT 'GENERAL',
  gender           TEXT           NOT NULL DEFAULT 'UNISEX',
  color            TEXT,
  season           TEXT,
  line             TEXT,
  brand_name       TEXT           NOT NULL DEFAULT 'Brand',
  brand_id         INTEGER        NOT NULL DEFAULT 1,
  tags             TEXT[]         NOT NULL DEFAULT '{}',
  description      TEXT,
  product_notes    TEXT,
  material         TEXT,
  srp              NUMERIC(10,2)  NOT NULL DEFAULT 0,
  wsp_usd          NUMERIC(10,2)  DEFAULT 0,
  cost             NUMERIC(10,2),
  margin           NUMERIC(6,4)   DEFAULT 0.5,
  moq              INTEGER        DEFAULT 1,
  delivery_window  TEXT,
  image_urls       TEXT[]         NOT NULL DEFAULT '{}',
  tier_pricing     JSONB          NOT NULL DEFAULT '[]',
  sizes            JSONB          NOT NULL DEFAULT '{}',
  stock_total      INTEGER        DEFAULT 0,
  status           TEXT           NOT NULL DEFAULT 'draft',
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- Ensure all canonical columns exist on existing databases
DO $$ BEGIN
  -- Rename legacy column names if still present
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='srp_usd')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='srp') THEN
    ALTER TABLE public.inventory RENAME COLUMN srp_usd TO srp;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='retail_srp')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='srp') THEN
    ALTER TABLE public.inventory RENAME COLUMN retail_srp TO srp;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='stock')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='stock_total') THEN
    ALTER TABLE public.inventory RENAME COLUMN stock TO stock_total;
  END IF;

  -- Drop orphaned column
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='wholesale_usd') THEN
    ALTER TABLE public.inventory DROP COLUMN wholesale_usd;
  END IF;

  -- Add missing columns (idempotent)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='srp') THEN
    ALTER TABLE public.inventory ADD COLUMN srp NUMERIC(10,2) NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='wsp_usd') THEN
    ALTER TABLE public.inventory ADD COLUMN wsp_usd NUMERIC(10,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='stock_total') THEN
    ALTER TABLE public.inventory ADD COLUMN stock_total INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='cost') THEN
    ALTER TABLE public.inventory ADD COLUMN cost NUMERIC(10,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='margin') THEN
    ALTER TABLE public.inventory ADD COLUMN margin NUMERIC(6,4) DEFAULT 0.5;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='material') THEN
    ALTER TABLE public.inventory ADD COLUMN material TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='product_notes') THEN
    ALTER TABLE public.inventory ADD COLUMN product_notes TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='moq') THEN
    ALTER TABLE public.inventory ADD COLUMN moq INTEGER DEFAULT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='delivery_window') THEN
    ALTER TABLE public.inventory ADD COLUMN delivery_window TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='color') THEN
    ALTER TABLE public.inventory ADD COLUMN color TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='gender') THEN
    ALTER TABLE public.inventory ADD COLUMN gender TEXT NOT NULL DEFAULT 'UNISEX';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='season') THEN
    ALTER TABLE public.inventory ADD COLUMN season TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='line') THEN
    ALTER TABLE public.inventory ADD COLUMN line TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='tags') THEN
    ALTER TABLE public.inventory ADD COLUMN tags TEXT[] NOT NULL DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='tier_pricing') THEN
    ALTER TABLE public.inventory ADD COLUMN tier_pricing JSONB NOT NULL DEFAULT '[]';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='brand_id') THEN
    ALTER TABLE public.inventory ADD COLUMN brand_id INTEGER NOT NULL DEFAULT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='brand_name') THEN
    ALTER TABLE public.inventory ADD COLUMN brand_name TEXT NOT NULL DEFAULT 'Brand';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='status') THEN
    ALTER TABLE public.inventory ADD COLUMN status TEXT NOT NULL DEFAULT 'draft';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='inventory' AND column_name='updated_at') THEN
    ALTER TABLE public.inventory ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;

-- Backfill NULL defaults
UPDATE public.inventory SET srp         = 0     WHERE srp         IS NULL;
UPDATE public.inventory SET wsp_usd     = 0     WHERE wsp_usd     IS NULL;
UPDATE public.inventory SET stock_total = 0     WHERE stock_total IS NULL;
UPDATE public.inventory SET moq         = 1     WHERE moq         IS NULL;
UPDATE public.inventory SET margin      = 0.5   WHERE margin      IS NULL;
UPDATE public.inventory SET tags        = '{}'  WHERE tags        IS NULL;
UPDATE public.inventory SET tier_pricing = '[]' WHERE tier_pricing IS NULL;
UPDATE public.inventory SET brand_id    = 1     WHERE brand_id    IS NULL;
UPDATE public.inventory SET status      = 'active' WHERE status   IS NULL;

-- UNIQUE constraint on sku
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.inventory'::regclass AND contype = 'u'
      AND conname IN ('inventory_sku_unique', 'inventory_sku_key')
  ) THEN
    IF (SELECT COUNT(*) FROM (SELECT sku FROM public.inventory WHERE sku IS NOT NULL AND sku != '' GROUP BY sku HAVING COUNT(*) > 1) t) = 0 THEN
      ALTER TABLE public.inventory ADD CONSTRAINT inventory_sku_unique UNIQUE (sku);
    END IF;
  END IF;
END $$;

-- Trigger
DROP TRIGGER IF EXISTS trg_inventory_updated_at ON public.inventory;
CREATE TRIGGER trg_inventory_updated_at
  BEFORE UPDATE ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_inventory_category   ON public.inventory (category);
CREATE INDEX IF NOT EXISTS idx_inventory_season     ON public.inventory (season);
CREATE INDEX IF NOT EXISTS idx_inventory_sku        ON public.inventory (sku);
CREATE INDEX IF NOT EXISTS idx_inventory_stock      ON public.inventory (stock_total);
CREATE INDEX IF NOT EXISTS idx_inventory_brand      ON public.inventory (brand_name);
CREATE INDEX IF NOT EXISTS idx_inventory_brand_id   ON public.inventory (brand_id);
CREATE INDEX IF NOT EXISTS idx_inventory_gender     ON public.inventory (gender);
CREATE INDEX IF NOT EXISTS idx_inventory_color      ON public.inventory (color);
CREATE INDEX IF NOT EXISTS idx_inventory_status     ON public.inventory (status);
CREATE INDEX IF NOT EXISTS idx_inventory_srp        ON public.inventory (srp);
CREATE INDEX IF NOT EXISTS idx_inventory_wsp_usd    ON public.inventory (wsp_usd);

-- RLS
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventory_select_all"         ON public.inventory;
DROP POLICY IF EXISTS "inventory_write_authenticated" ON public.inventory;

CREATE POLICY "inventory_select_all"
  ON public.inventory FOR SELECT USING (true);

CREATE POLICY "inventory_write_authenticated"
  ON public.inventory FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. BUYERS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.buyers (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  email               TEXT          UNIQUE NOT NULL,
  store_name          TEXT          NOT NULL,
  password_hash       TEXT          NOT NULL,
  temp_password       BOOLEAN       NOT NULL DEFAULT true,
  status              TEXT          NOT NULL DEFAULT 'pending',

  first_name          TEXT,
  last_name           TEXT,
  phone               TEXT,
  store_address       TEXT,
  city                TEXT,
  country             TEXT          DEFAULT 'US',
  store_url           TEXT,
  instagram           TEXT,
  tiktok              TEXT,
  linkedin            TEXT,
  other_socials       TEXT,

  store_type          TEXT,
  categories_sold     TEXT[]        NOT NULL DEFAULT '{}',
  price_range_min     NUMERIC(10,2),
  price_range_max     NUMERIC(10,2),
  market_segment      TEXT,
  annual_buy_budget   NUMERIC(12,2),

  registered_by       TEXT,
  registered_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  onboarded_at        TIMESTAMPTZ,
  last_login_at       TIMESTAMPTZ,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.buyer_analysis (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id              UUID          NOT NULL REFERENCES public.buyers(id) ON DELETE CASCADE,
  style_dna             JSONB         NOT NULL DEFAULT '{}',
  price_sensitivity     TEXT,
  category_weights      JSONB         NOT NULL DEFAULT '{}',
  trend_alignment       TEXT,
  personalization_tags  TEXT[]        NOT NULL DEFAULT '{}',
  newsletter_topics     TEXT[]        NOT NULL DEFAULT '{}',
  brand_affinities      TEXT[]        NOT NULL DEFAULT '{}',
  avg_order_value       NUMERIC(10,2),
  total_orders          INTEGER       NOT NULL DEFAULT 0,
  total_spend           NUMERIC(12,2) NOT NULL DEFAULT 0,
  analyzed_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  version               INTEGER       NOT NULL DEFAULT 1,
  UNIQUE(buyer_id)
);

DROP TRIGGER IF EXISTS trg_buyers_updated_at ON public.buyers;
CREATE TRIGGER trg_buyers_updated_at
  BEFORE UPDATE ON public.buyers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_buyers_email         ON public.buyers (email);
CREATE INDEX IF NOT EXISTS idx_buyers_status        ON public.buyers (status);
CREATE INDEX IF NOT EXISTS idx_buyers_registered_by ON public.buyers (registered_by);
CREATE INDEX IF NOT EXISTS idx_buyer_analysis_buyer ON public.buyer_analysis (buyer_id);

ALTER TABLE public.buyers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_analysis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "buyers_service_all"         ON public.buyers;
DROP POLICY IF EXISTS "buyer_analysis_service_all" ON public.buyer_analysis;

CREATE POLICY "buyers_service_all"
  ON public.buyers FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "buyer_analysis_service_all"
  ON public.buyer_analysis FOR ALL USING (true) WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. BUYER ORDERS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.buyer_orders (
  id               TEXT          PRIMARY KEY,
  buyer_id         UUID,
  buyer_name       TEXT,
  brand_id         UUID,
  status           TEXT          NOT NULL DEFAULT 'new',
  total_usd        DECIMAL(14,2) NOT NULL DEFAULT 0,
  currency         TEXT          DEFAULT 'USD',
  terms            TEXT,
  notes            TEXT,
  items            JSONB         DEFAULT '[]',
  fulfillment_type TEXT          NOT NULL DEFAULT 'IMMEDIATE'
                                 CHECK (fulfillment_type IN ('IMMEDIATE','FUTURE_ALLOCATION','MIXED')),
  created_at       TIMESTAMPTZ   DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   DEFAULT NOW()
);

-- Add fulfillment_type to existing databases
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='buyer_orders' AND column_name='fulfillment_type'
  ) THEN
    ALTER TABLE public.buyer_orders
      ADD COLUMN fulfillment_type TEXT NOT NULL DEFAULT 'IMMEDIATE'
        CHECK (fulfillment_type IN ('IMMEDIATE','FUTURE_ALLOCATION','MIXED'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_buyer_orders_buyer_id   ON public.buyer_orders (buyer_id);
CREATE INDEX IF NOT EXISTS idx_buyer_orders_brand_id   ON public.buyer_orders (brand_id);
CREATE INDEX IF NOT EXISTS idx_buyer_orders_status     ON public.buyer_orders (status);
CREATE INDEX IF NOT EXISTS idx_buyer_orders_created_at ON public.buyer_orders (created_at DESC);

ALTER TABLE public.buyer_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users own their orders" ON public.buyer_orders;
CREATE POLICY "users own their orders"
  ON public.buyer_orders FOR ALL
  USING (auth.uid()::text = buyer_id::text);


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. INTEGRATION CONFIGS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.integration_configs (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id     TEXT          NOT NULL,
  platform     TEXT          NOT NULL,
  access_token TEXT,
  shop_domain  TEXT,
  external_id  TEXT,
  config       JSONB         DEFAULT '{}',
  active       BOOLEAN       DEFAULT true,
  connected_at TIMESTAMPTZ   DEFAULT NOW(),
  last_sync_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ   DEFAULT NOW(),
  UNIQUE(brand_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_integration_configs_brand_id ON public.integration_configs (brand_id);
CREATE INDEX IF NOT EXISTS idx_integration_configs_platform ON public.integration_configs (platform);


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. INQUIRIES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.inquiries (
  id          BIGSERIAL     PRIMARY KEY,
  buyer_id    UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_name  TEXT          NOT NULL,
  subject     TEXT          NOT NULL,
  status      TEXT          NOT NULL DEFAULT 'open'
                            CHECK (status IN ('open','replied','closed')),
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inquiry_messages (
  id          BIGSERIAL     PRIMARY KEY,
  inquiry_id  BIGINT        NOT NULL REFERENCES public.inquiries(id) ON DELETE CASCADE,
  sender_id   UUID          NOT NULL REFERENCES auth.users(id),
  body        TEXT          NOT NULL,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.touch_inquiry_on_message()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.inquiries
  SET updated_at = NOW(),
      status     = CASE WHEN status = 'closed' THEN 'closed' ELSE 'open' END
  WHERE id = NEW.inquiry_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_inquiry ON public.inquiry_messages;
CREATE TRIGGER trg_touch_inquiry
  AFTER INSERT ON public.inquiry_messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_inquiry_on_message();

CREATE INDEX IF NOT EXISTS idx_inquiries_buyer      ON public.inquiries (buyer_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_brand      ON public.inquiries (brand_name);
CREATE INDEX IF NOT EXISTS idx_inquiries_updated    ON public.inquiries (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_inq_messages_inquiry ON public.inquiry_messages (inquiry_id);

ALTER TABLE public.inquiries        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiry_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inquiries_buyer_select" ON public.inquiries;
DROP POLICY IF EXISTS "inquiries_buyer_insert" ON public.inquiries;
DROP POLICY IF EXISTS "inquiries_buyer_update" ON public.inquiries;
DROP POLICY IF EXISTS "inq_messages_select"    ON public.inquiry_messages;
DROP POLICY IF EXISTS "inq_messages_insert"    ON public.inquiry_messages;

CREATE POLICY "inquiries_buyer_select" ON public.inquiries FOR SELECT USING (buyer_id = auth.uid());
CREATE POLICY "inquiries_buyer_insert" ON public.inquiries FOR INSERT WITH CHECK (buyer_id = auth.uid());
CREATE POLICY "inquiries_buyer_update" ON public.inquiries FOR UPDATE USING (buyer_id = auth.uid());

CREATE POLICY "inq_messages_select"
  ON public.inquiry_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.inquiries i WHERE i.id = inquiry_id AND i.buyer_id = auth.uid()));

CREATE POLICY "inq_messages_insert"
  ON public.inquiry_messages FOR INSERT
  WITH CHECK (sender_id = auth.uid());


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. BUYER FAVORITES & ALERTS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.buyer_favorites (
  id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type  TEXT          NOT NULL CHECK (item_type IN ('product','brand')),
  item_id    TEXT          NOT NULL,
  item_label TEXT,
  created_at TIMESTAMPTZ   DEFAULT NOW(),
  UNIQUE(user_id, item_type, item_id)
);

CREATE TABLE IF NOT EXISTS public.buyer_alert_prefs (
  user_id       UUID      PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_alerts  BOOLEAN   DEFAULT true,
  in_app_alerts BOOLEAN   DEFAULT true,
  alert_on      TEXT[]    DEFAULT ARRAY['new_stock','price_change','promotion','new_collection'],
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.buyer_alerts (
  id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type  TEXT          NOT NULL,
  item_id    TEXT          NOT NULL,
  item_label TEXT,
  alert_type TEXT          NOT NULL,
  title      TEXT          NOT NULL,
  body       TEXT,
  read       BOOLEAN       DEFAULT false,
  created_at TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buyer_favorites_user ON public.buyer_favorites (user_id);
CREATE INDEX IF NOT EXISTS idx_buyer_alerts_user    ON public.buyer_alerts (user_id);
CREATE INDEX IF NOT EXISTS idx_buyer_alerts_read    ON public.buyer_alerts (user_id, read);

ALTER TABLE public.buyer_favorites   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_alert_prefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_alerts      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users own their favorites" ON public.buyer_favorites;
DROP POLICY IF EXISTS "users own their prefs"     ON public.buyer_alert_prefs;
DROP POLICY IF EXISTS "users own their alerts"    ON public.buyer_alerts;

CREATE POLICY "users own their favorites" ON public.buyer_favorites   FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users own their prefs"     ON public.buyer_alert_prefs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users own their alerts"    ON public.buyer_alerts      FOR ALL USING (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. BUYER CART
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.buyer_cart (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id         TEXT          NOT NULL,
  brand_name      TEXT,
  title           TEXT,
  style_number    TEXT,
  colour          TEXT,
  image_url       TEXT,
  retail_price    DECIMAL(14,2),
  wholesale_price DECIMAL(14,2),
  sizes           JSONB         DEFAULT '{}',
  qty             INT           DEFAULT 0,
  created_at      TIMESTAMPTZ   DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   DEFAULT NOW(),
  UNIQUE(user_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_buyer_cart_user ON public.buyer_cart (user_id);

ALTER TABLE public.buyer_cart ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users own their cart" ON public.buyer_cart;
CREATE POLICY "users own their cart" ON public.buyer_cart FOR ALL USING (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. BUYER STOREFRONTS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.buyer_storefronts (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug            TEXT          NOT NULL UNIQUE,
  name            TEXT          NOT NULL,
  tagline         TEXT,
  description     TEXT,
  logo_url        TEXT,
  banner_url      TEXT,
  accent_color    TEXT          DEFAULT '#000000',
  contact_email   TEXT,
  instagram       TEXT,
  website         TEXT,
  custom_domain   TEXT,
  domain_verified BOOLEAN       DEFAULT false,
  published       BOOLEAN       DEFAULT false,
  theme           JSONB         DEFAULT '{
    "font_heading":       "serif",
    "font_body":          "sans",
    "font_size_scale":    "default",
    "heading_weight":     "400",
    "heading_transform":  "none",
    "letter_spacing":     "normal",
    "color_accent":       "#c9a84c",
    "color_bg":           "#ffffff",
    "color_text":         "#111111",
    "color_surface":      "#f9f9f9",
    "color_nav_bg":       "",
    "color_nav_text":     "",
    "color_button_bg":    "",
    "color_button_text":  "#ffffff",
    "color_border":       "#f0f0f0",
    "nav_style":          "minimal",
    "page_width":         "contained",
    "section_padding":    "standard",
    "grid_columns":       3,
    "product_card_style": "editorial",
    "button_style":       "solid",
    "button_radius":      "none",
    "sections": [
      { "id": "hero",     "type": "hero",             "enabled": true,  "headline": "Our Collection", "subheadline": "Curated pieces from the finest houses.", "cta_label": "Shop Now", "cta_link": "#collection", "bg_color": "#0a0a0a", "text_color": "#ffffff" },
      { "id": "featured", "type": "featured_products", "enabled": true,  "title": "New Arrivals", "count": 8, "layout": "grid" },
      { "id": "about",    "type": "about",             "enabled": false, "heading": "Our Story",     "body": "Tell your customers who you are." },
      { "id": "brands",   "type": "brands_bar",        "enabled": true  },
      { "id": "contact",  "type": "contact",           "enabled": true,  "heading": "Get in Touch" }
    ]
  }'::jsonb,
  created_at      TIMESTAMPTZ   DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Add missing columns to existing storefronts table
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='buyer_storefronts' AND column_name='custom_domain') THEN
    ALTER TABLE public.buyer_storefronts ADD COLUMN custom_domain TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='buyer_storefronts' AND column_name='domain_verified') THEN
    ALTER TABLE public.buyer_storefronts ADD COLUMN domain_verified BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='buyer_storefronts' AND column_name='theme') THEN
    ALTER TABLE public.buyer_storefronts ADD COLUMN theme JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Backfill extended theme fields on existing rows
UPDATE public.buyer_storefronts
SET theme = COALESCE(theme, '{}'::jsonb) || jsonb_build_object(
  'font_size_scale',    COALESCE(theme->>'font_size_scale',    'default'),
  'heading_weight',     COALESCE(theme->>'heading_weight',     '400'),
  'heading_transform',  COALESCE(theme->>'heading_transform',  'none'),
  'letter_spacing',     COALESCE(theme->>'letter_spacing',     'normal'),
  'color_nav_bg',       COALESCE(theme->>'color_nav_bg',       ''),
  'color_nav_text',     COALESCE(theme->>'color_nav_text',     ''),
  'color_button_bg',    COALESCE(theme->>'color_button_bg',    ''),
  'color_button_text',  COALESCE(theme->>'color_button_text',  '#ffffff'),
  'color_border',       COALESCE(theme->>'color_border',       '#f0f0f0'),
  'nav_style',          COALESCE(theme->>'nav_style',          'minimal'),
  'page_width',         COALESCE(theme->>'page_width',         'contained'),
  'section_padding',    COALESCE(theme->>'section_padding',    'standard'),
  'grid_columns',       COALESCE((theme->>'grid_columns')::int, 3),
  'product_card_style', COALESCE(theme->>'product_card_style', 'editorial'),
  'button_style',       COALESCE(theme->>'button_style',       'solid'),
  'button_radius',      COALESCE(theme->>'button_radius',      'none')
)
WHERE theme IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.storefront_products (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  storefront_id   UUID          NOT NULL REFERENCES public.buyer_storefronts(id) ON DELETE CASCADE,
  catalog_item_id TEXT          NOT NULL,
  consumer_price  DECIMAL(14,2),
  featured        BOOLEAN       DEFAULT false,
  sort_order      INT           DEFAULT 0,
  published       BOOLEAN       DEFAULT true,
  created_at      TIMESTAMPTZ   DEFAULT NOW(),
  UNIQUE(storefront_id, catalog_item_id)
);

CREATE TABLE IF NOT EXISTS public.storefront_enquiries (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  storefront_id UUID          NOT NULL REFERENCES public.buyer_storefronts(id) ON DELETE CASCADE,
  product_id    TEXT,
  name          TEXT          NOT NULL,
  email         TEXT          NOT NULL,
  message       TEXT,
  created_at    TIMESTAMPTZ   DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_storefronts_custom_domain ON public.buyer_storefronts (custom_domain) WHERE custom_domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_storefronts_slug       ON public.buyer_storefronts (slug);
CREATE INDEX IF NOT EXISTS idx_storefronts_user_id    ON public.buyer_storefronts (user_id);
CREATE INDEX IF NOT EXISTS idx_sf_products_storefront ON public.storefront_products (storefront_id);

ALTER TABLE public.buyer_storefronts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storefront_products  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storefront_enquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner full access storefronts"      ON public.buyer_storefronts;
DROP POLICY IF EXISTS "owner full access sf_products"      ON public.storefront_products;
DROP POLICY IF EXISTS "owner reads enquiries"              ON public.storefront_enquiries;
DROP POLICY IF EXISTS "public reads published storefronts" ON public.buyer_storefronts;
DROP POLICY IF EXISTS "public reads published products"    ON public.storefront_products;
DROP POLICY IF EXISTS "public can enquire"                 ON public.storefront_enquiries;

CREATE POLICY "owner full access storefronts"
  ON public.buyer_storefronts FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "owner full access sf_products"
  ON public.storefront_products FOR ALL
  USING (storefront_id IN (SELECT id FROM public.buyer_storefronts WHERE user_id = auth.uid()));

CREATE POLICY "owner reads enquiries"
  ON public.storefront_enquiries FOR SELECT
  USING (storefront_id IN (SELECT id FROM public.buyer_storefronts WHERE user_id = auth.uid()));

CREATE POLICY "public reads published storefronts"
  ON public.buyer_storefronts FOR SELECT USING (published = true);

CREATE POLICY "public reads published products"
  ON public.storefront_products FOR SELECT
  USING (published = true AND storefront_id IN (SELECT id FROM public.buyer_storefronts WHERE published = true));

CREATE POLICY "public can enquire"
  ON public.storefront_enquiries FOR INSERT WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- 9. BRAND STOREFRONTS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.brand_storefronts (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_name      TEXT          NOT NULL,
  slug            TEXT          NOT NULL UNIQUE,
  display_name    TEXT          NOT NULL,
  tagline         TEXT,
  description     TEXT,
  logo_url        TEXT,
  banner_url      TEXT,
  contact_email   TEXT,
  instagram       TEXT,
  website         TEXT,
  custom_domain   TEXT,
  domain_verified BOOLEAN       DEFAULT false,
  published       BOOLEAN       DEFAULT false,
  theme           JSONB         DEFAULT '{
    "font_heading":       "serif",
    "font_body":          "sans",
    "font_size_scale":    "default",
    "heading_weight":     "400",
    "heading_transform":  "none",
    "letter_spacing":     "normal",
    "color_accent":       "#c9a84c",
    "color_bg":           "#ffffff",
    "color_text":         "#111111",
    "color_surface":      "#f9f9f9",
    "color_nav_bg":       "",
    "color_nav_text":     "",
    "color_button_bg":    "",
    "color_button_text":  "#ffffff",
    "color_border":       "#f0f0f0",
    "nav_style":          "minimal",
    "page_width":         "contained",
    "section_padding":    "standard",
    "grid_columns":       3,
    "product_card_style": "editorial",
    "button_style":       "solid",
    "button_radius":      "none",
    "sections": [
      { "id": "hero",     "type": "hero",             "enabled": true,  "headline": "Our Collection", "subheadline": "Explore our latest pieces.", "cta_label": "Shop Now", "cta_link": "#collection", "bg_color": "#0a0a0a", "text_color": "#ffffff" },
      { "id": "featured", "type": "featured_products", "enabled": true,  "title": "New Arrivals", "count": 8, "layout": "grid" },
      { "id": "about",    "type": "about",             "enabled": false, "heading": "About the Brand", "body": "" },
      { "id": "contact",  "type": "contact",           "enabled": true,  "heading": "Get in Touch" }
    ]
  }'::jsonb,
  created_at      TIMESTAMPTZ   DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Backfill extended theme on existing brand storefronts
UPDATE public.brand_storefronts
SET theme = COALESCE(theme, '{}'::jsonb) || jsonb_build_object(
  'font_size_scale',    COALESCE(theme->>'font_size_scale',    'default'),
  'heading_weight',     COALESCE(theme->>'heading_weight',     '400'),
  'heading_transform',  COALESCE(theme->>'heading_transform',  'none'),
  'letter_spacing',     COALESCE(theme->>'letter_spacing',     'normal'),
  'color_nav_bg',       COALESCE(theme->>'color_nav_bg',       ''),
  'color_nav_text',     COALESCE(theme->>'color_nav_text',     ''),
  'color_button_bg',    COALESCE(theme->>'color_button_bg',    ''),
  'color_button_text',  COALESCE(theme->>'color_button_text',  '#ffffff'),
  'color_border',       COALESCE(theme->>'color_border',       '#f0f0f0'),
  'nav_style',          COALESCE(theme->>'nav_style',          'minimal'),
  'page_width',         COALESCE(theme->>'page_width',         'contained'),
  'section_padding',    COALESCE(theme->>'section_padding',    'standard'),
  'grid_columns',       COALESCE((theme->>'grid_columns')::int, 3),
  'product_card_style', COALESCE(theme->>'product_card_style', 'editorial'),
  'button_style',       COALESCE(theme->>'button_style',       'solid'),
  'button_radius',      COALESCE(theme->>'button_radius',      'none')
)
WHERE theme IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.brand_storefront_products (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  storefront_id   UUID          NOT NULL REFERENCES public.brand_storefronts(id) ON DELETE CASCADE,
  inventory_id    INT           NOT NULL,
  consumer_price  DECIMAL(14,2),
  featured        BOOLEAN       DEFAULT false,
  sort_order      INT           DEFAULT 0,
  published       BOOLEAN       DEFAULT true,
  created_at      TIMESTAMPTZ   DEFAULT NOW(),
  UNIQUE(storefront_id, inventory_id)
);

CREATE TABLE IF NOT EXISTS public.brand_storefront_enquiries (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  storefront_id UUID          NOT NULL REFERENCES public.brand_storefronts(id) ON DELETE CASCADE,
  inventory_id  INT,
  name          TEXT          NOT NULL,
  email         TEXT          NOT NULL,
  message       TEXT,
  created_at    TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brand_storefronts_slug       ON public.brand_storefronts (slug);
CREATE INDEX IF NOT EXISTS idx_brand_storefronts_user_id    ON public.brand_storefronts (user_id);
CREATE INDEX IF NOT EXISTS idx_brand_storefronts_brand_name ON public.brand_storefronts (brand_name);
CREATE INDEX IF NOT EXISTS idx_brand_sf_products_storefront ON public.brand_storefront_products (storefront_id);

ALTER TABLE public.brand_storefronts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_storefront_products   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_storefront_enquiries  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner brand storefronts"                ON public.brand_storefronts;
DROP POLICY IF EXISTS "owner brand sf products"                ON public.brand_storefront_products;
DROP POLICY IF EXISTS "owner reads brand enquiries"            ON public.brand_storefront_enquiries;
DROP POLICY IF EXISTS "public reads published brand storefronts" ON public.brand_storefronts;
DROP POLICY IF EXISTS "public reads published brand products"  ON public.brand_storefront_products;
DROP POLICY IF EXISTS "public can enquire brand"               ON public.brand_storefront_enquiries;

CREATE POLICY "owner brand storefronts"
  ON public.brand_storefronts FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "owner brand sf products"
  ON public.brand_storefront_products FOR ALL
  USING (storefront_id IN (SELECT id FROM public.brand_storefronts WHERE user_id = auth.uid()));

CREATE POLICY "owner reads brand enquiries"
  ON public.brand_storefront_enquiries FOR SELECT
  USING (storefront_id IN (SELECT id FROM public.brand_storefronts WHERE user_id = auth.uid()));

CREATE POLICY "public reads published brand storefronts"
  ON public.brand_storefronts FOR SELECT USING (published = true);

CREATE POLICY "public reads published brand products"
  ON public.brand_storefront_products FOR SELECT
  USING (published = true AND storefront_id IN (SELECT id FROM public.brand_storefronts WHERE published = true));

CREATE POLICY "public can enquire brand"
  ON public.brand_storefront_enquiries FOR INSERT WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- 10. BRAND RECOMMENDATION CAMPAIGNS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.brand_recommendation_campaigns (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_user_id   UUID          NOT NULL,
  brand_name      TEXT          NOT NULL,
  name            TEXT          NOT NULL,
  subject         TEXT          NOT NULL,
  message         TEXT,
  product_ids     BIGINT[]      NOT NULL DEFAULT '{}',
  targeting       JSONB         NOT NULL DEFAULT '{}',
  status          TEXT          NOT NULL DEFAULT 'draft',
  sent_at         TIMESTAMPTZ,
  total_sent      INTEGER       NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT campaign_status CHECK (status IN ('draft','sent'))
);

CREATE TABLE IF NOT EXISTS public.brand_recommendation_sends (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID          NOT NULL REFERENCES public.brand_recommendation_campaigns(id) ON DELETE CASCADE,
  buyer_id    UUID          NOT NULL REFERENCES public.buyers(id) ON DELETE CASCADE,
  buyer_email TEXT          NOT NULL,
  match_score INTEGER       NOT NULL DEFAULT 0,
  sent_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (campaign_id, buyer_id)
);

DROP TRIGGER IF EXISTS trg_brc_updated_at ON public.brand_recommendation_campaigns;
CREATE TRIGGER trg_brc_updated_at
  BEFORE UPDATE ON public.brand_recommendation_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_brc_brand_user ON public.brand_recommendation_campaigns (brand_user_id);
CREATE INDEX IF NOT EXISTS idx_brc_status     ON public.brand_recommendation_campaigns (status);
CREATE INDEX IF NOT EXISTS idx_brs_campaign   ON public.brand_recommendation_sends (campaign_id);
CREATE INDEX IF NOT EXISTS idx_brs_buyer      ON public.brand_recommendation_sends (buyer_id);

ALTER TABLE public.brand_recommendation_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_recommendation_sends     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brc_owner_all" ON public.brand_recommendation_campaigns;
DROP POLICY IF EXISTS "brs_service"   ON public.brand_recommendation_sends;

CREATE POLICY "brc_owner_all"
  ON public.brand_recommendation_campaigns FOR ALL
  USING (brand_user_id = auth.uid()) WITH CHECK (brand_user_id = auth.uid());

CREATE POLICY "brs_service"
  ON public.brand_recommendation_sends FOR ALL USING (true) WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- 11. BRAND PROMOTIONS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.brand_promotions (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_user_id   UUID          NOT NULL,
  brand_name      TEXT          NOT NULL,
  name            TEXT          NOT NULL,
  headline        TEXT          NOT NULL,
  description     TEXT,
  promo_type      TEXT          NOT NULL,
  discount_pct    NUMERIC(5,2)  NOT NULL,
  min_qty         INTEGER,
  min_spend       NUMERIC(10,2),
  target_category TEXT,
  min_tier        TEXT          NOT NULL DEFAULT 'silver',
  product_ids     BIGINT[]      NOT NULL DEFAULT '{}',
  expires_at      TIMESTAMPTZ,
  active          BOOLEAN       NOT NULL DEFAULT true,
  total_assigned  INTEGER       NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT promo_type_check CHECK (promo_type IN ('volume_discount','spend_threshold','category_deal','loyalty_reward')),
  CONSTRAINT promo_tier_check CHECK (min_tier IN ('silver','gold','platinum'))
);

CREATE TABLE IF NOT EXISTS public.brand_promotion_assignments (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id    UUID          NOT NULL REFERENCES public.brand_promotions(id) ON DELETE CASCADE,
  brand_user_id   UUID          NOT NULL,
  buyer_id        UUID          NOT NULL REFERENCES public.buyers(id) ON DELETE CASCADE,
  buyer_email     TEXT          NOT NULL,
  account_tier    TEXT          NOT NULL DEFAULT 'silver',
  account_score   INTEGER       NOT NULL DEFAULT 0,
  pricing_rule_id UUID,
  status          TEXT          NOT NULL DEFAULT 'active',
  email_sent      BOOLEAN       NOT NULL DEFAULT false,
  email_sent_at   TIMESTAMPTZ,
  assigned_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (promotion_id, buyer_id),
  CONSTRAINT assign_status_check CHECK (status IN ('active','redeemed','expired','revoked'))
);

DROP TRIGGER IF EXISTS trg_bp_updated_at ON public.brand_promotions;
CREATE TRIGGER trg_bp_updated_at
  BEFORE UPDATE ON public.brand_promotions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_bp_brand_user  ON public.brand_promotions           (brand_user_id);
CREATE INDEX IF NOT EXISTS idx_bpa_promotion  ON public.brand_promotion_assignments (promotion_id);
CREATE INDEX IF NOT EXISTS idx_bpa_buyer      ON public.brand_promotion_assignments (buyer_id);
CREATE INDEX IF NOT EXISTS idx_bpa_brand_user ON public.brand_promotion_assignments (brand_user_id);

ALTER TABLE public.brand_promotions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_promotion_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bp_owner_all"  ON public.brand_promotions;
DROP POLICY IF EXISTS "bpa_owner_all" ON public.brand_promotion_assignments;

CREATE POLICY "bp_owner_all"
  ON public.brand_promotions FOR ALL
  USING (brand_user_id = auth.uid()) WITH CHECK (brand_user_id = auth.uid());

CREATE POLICY "bpa_owner_all"
  ON public.brand_promotion_assignments FOR ALL
  USING (brand_user_id = auth.uid()) WITH CHECK (brand_user_id = auth.uid());


-- ─────────────────────────────────────────────────────────────────────────────
-- 12. BUYER PRICING & VISIBILITY RULES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.buyer_pricing_rules (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id      UUID          NOT NULL REFERENCES public.buyers(id) ON DELETE CASCADE,
  rule_type     TEXT          NOT NULL,
  target        TEXT,
  discount_pct  NUMERIC(5,2),
  fixed_price   NUMERIC(10,2),
  active        BOOLEAN       NOT NULL DEFAULT true,
  note          TEXT,
  brand_name    TEXT,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT pricing_rule_type  CHECK (rule_type IN ('global','category','brand','sku')),
  CONSTRAINT pricing_has_value  CHECK (discount_pct IS NOT NULL OR fixed_price IS NOT NULL),
  CONSTRAINT pricing_target_req CHECK (rule_type = 'global' OR target IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.buyer_visibility_rules (
  id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id   UUID          NOT NULL REFERENCES public.buyers(id) ON DELETE CASCADE,
  rule_type  TEXT          NOT NULL,
  target     TEXT          NOT NULL,
  active     BOOLEAN       NOT NULL DEFAULT true,
  note       TEXT,
  created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT visibility_rule_type CHECK (
    rule_type IN ('hide_category','hide_brand','hide_sku','show_only_category','show_only_brand')
  )
);

DROP TRIGGER IF EXISTS trg_buyer_pricing_rules_updated_at ON public.buyer_pricing_rules;
CREATE TRIGGER trg_buyer_pricing_rules_updated_at
  BEFORE UPDATE ON public.buyer_pricing_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_bpr_buyer_id    ON public.buyer_pricing_rules    (buyer_id);
CREATE INDEX IF NOT EXISTS idx_bvr_buyer_id    ON public.buyer_visibility_rules (buyer_id);
CREATE INDEX IF NOT EXISTS idx_bpr_type_target ON public.buyer_pricing_rules    (buyer_id, rule_type, target);

ALTER TABLE public.buyer_pricing_rules    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_visibility_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bpr_service_all" ON public.buyer_pricing_rules;
DROP POLICY IF EXISTS "bvr_service_all" ON public.buyer_visibility_rules;

CREATE POLICY "bpr_service_all" ON public.buyer_pricing_rules    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "bvr_service_all" ON public.buyer_visibility_rules FOR ALL USING (true) WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- 13. SESSION STORE
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.session_store (
  id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT          NOT NULL,
  type       TEXT          NOT NULL CHECK (type IN ('cart','saved','offer')),
  data       JSONB         NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ   NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);

CREATE INDEX IF NOT EXISTS session_store_session_type ON public.session_store (session_id, type);

ALTER TABLE public.session_store ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner access" ON public.session_store;
CREATE POLICY "owner access"
  ON public.session_store
  USING (session_id = auth.uid()::text)
  WITH CHECK (session_id = auth.uid()::text);


-- ─────────────────────────────────────────────────────────────────────────────
-- 14. STORAGE — product-images bucket
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images', 'product-images', true, 10485760,
  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/bmp','image/tiff','image/avif']
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='product-images public read') THEN
    CREATE POLICY "product-images public read" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='product-images auth insert') THEN
    CREATE POLICY "product-images auth insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'product-images' AND auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='product-images auth update') THEN
    CREATE POLICY "product-images auth update" ON storage.objects FOR UPDATE USING (bucket_id = 'product-images' AND auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='product-images auth delete') THEN
    CREATE POLICY "product-images auth delete" ON storage.objects FOR DELETE USING (bucket_id = 'product-images' AND auth.role() = 'authenticated');
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 15. VIEWS
-- ─────────────────────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS public.buyer_vip_catalog;
CREATE OR REPLACE VIEW public.buyer_vip_catalog AS
SELECT
  id,
  title,
  sku,
  category,
  gender,
  color,
  season,
  line,
  brand_name,
  brand_id,
  tags,
  description,
  product_notes,
  material,
  srp                                            AS retail_price,
  COALESCE(wsp_usd, srp * 0.40)                 AS wholesale_price,
  srp,
  wsp_usd,
  cost,
  margin,
  moq,
  delivery_window,
  image_urls,
  CASE
    WHEN array_length(image_urls, 1) > 0 THEN image_urls[1]
    ELSE NULL
  END                                            AS image_url,
  tier_pricing,
  sizes,
  stock_total,
  CASE
    WHEN COALESCE(stock_total, 0) = 0 AND delivery_window IS NULL THEN 'Out of Stock'
    WHEN COALESCE(stock_total, 0) <= 5                            THEN 'Low Stock'
    WHEN delivery_window IS NOT NULL
         AND delivery_window NOT ILIKE '%now%'                    THEN 'Pre-Order'
    ELSE                                                               'Ready to Ship'
  END                                            AS inventory_status,
  status,
  created_at,
  updated_at
FROM public.inventory
WHERE status = 'active';


-- ─────────────────────────────────────────────────────────────────────────────
-- 16. FUNCTIONS / RPC
-- ─────────────────────────────────────────────────────────────────────────────

-- ── get_buyer_catalog ─────────────────────────────────────────────────────────
-- Returns the active catalog for a specific buyer, applying their
-- pricing and visibility rules. Priority: sku > brand > category > global.

DROP FUNCTION IF EXISTS public.get_buyer_catalog(UUID);
CREATE OR REPLACE FUNCTION public.get_buyer_catalog(p_buyer_id UUID)
RETURNS TABLE (
  id               BIGINT,
  title            TEXT,
  sku              TEXT,
  category         TEXT,
  brand_name       TEXT,
  brand_id         INTEGER,
  gender           TEXT,
  color            TEXT,
  season           TEXT,
  line             TEXT,
  tags             TEXT[],
  description      TEXT,
  retail_price     NUMERIC,
  wholesale_price  NUMERIC,
  base_wsp         NUMERIC,
  moq              INTEGER,
  delivery_window  TEXT,
  image_urls       TEXT[],
  image_url        TEXT,
  sizes            JSONB,
  tier_pricing     JSONB,
  inventory_status TEXT,
  stock_total      INTEGER,
  created_at       TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
  v_has_show_only_cat   BOOLEAN;
  v_has_show_only_brand BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.buyer_visibility_rules
    WHERE buyer_id = p_buyer_id AND rule_type = 'show_only_category' AND active = true
  ) INTO v_has_show_only_cat;

  SELECT EXISTS (
    SELECT 1 FROM public.buyer_visibility_rules
    WHERE buyer_id = p_buyer_id AND rule_type = 'show_only_brand' AND active = true
  ) INTO v_has_show_only_brand;

  RETURN QUERY
  WITH
  pricing AS (
    SELECT rule_type, target, discount_pct, fixed_price
    FROM public.buyer_pricing_rules
    WHERE buyer_id = p_buyer_id AND active = true
  ),
  visibility AS (
    SELECT rule_type, target
    FROM public.buyer_visibility_rules
    WHERE buyer_id = p_buyer_id AND active = true
  ),
  base AS (
    SELECT
      inv.id, inv.title, inv.sku, inv.category, inv.brand_name, inv.brand_id,
      inv.gender, inv.color, inv.season, inv.line, inv.tags, inv.description,
      COALESCE(inv.srp, 0)                               AS retail_price,
      COALESCE(inv.wsp_usd, inv.srp * 0.40, 0)          AS base_wsp,
      inv.moq, inv.delivery_window, inv.image_urls,
      CASE WHEN array_length(inv.image_urls, 1) > 0 THEN inv.image_urls[1] ELSE NULL END AS image_url,
      inv.sizes, inv.tier_pricing,
      CASE
        WHEN COALESCE(inv.stock_total, 0) = 0 AND inv.delivery_window IS NULL THEN 'Out of Stock'
        WHEN COALESCE(inv.stock_total, 0) <= 5                                THEN 'Low Stock'
        WHEN inv.delivery_window IS NOT NULL
             AND inv.delivery_window NOT ILIKE '%now%'                        THEN 'Pre-Order'
        ELSE                                                                       'Ready to Ship'
      END AS inventory_status,
      COALESCE(inv.stock_total, 0) AS stock_total,
      inv.created_at, inv.updated_at
    FROM public.inventory inv
    WHERE inv.status = 'active'
  ),
  visible AS (
    SELECT b.* FROM base b
    WHERE
      NOT EXISTS (SELECT 1 FROM visibility v WHERE v.rule_type = 'hide_sku'      AND v.target = b.sku)
      AND NOT EXISTS (SELECT 1 FROM visibility v WHERE v.rule_type = 'hide_category' AND v.target = b.category)
      AND NOT EXISTS (SELECT 1 FROM visibility v WHERE v.rule_type = 'hide_brand'    AND v.target = b.brand_name)
      AND (NOT v_has_show_only_cat   OR EXISTS (SELECT 1 FROM visibility v WHERE v.rule_type = 'show_only_category' AND v.target = b.category))
      AND (NOT v_has_show_only_brand OR EXISTS (SELECT 1 FROM visibility v WHERE v.rule_type = 'show_only_brand'    AND v.target = b.brand_name))
  ),
  priced AS (
    SELECT
      vis.*,
      COALESCE(
        (SELECT fixed_price FROM pricing p WHERE p.rule_type='sku'      AND p.target=vis.sku        AND p.fixed_price IS NOT NULL LIMIT 1),
        CASE WHEN EXISTS(SELECT 1 FROM pricing p WHERE p.rule_type='sku'      AND p.target=vis.sku        AND p.discount_pct IS NOT NULL)
          THEN vis.base_wsp*(1-(SELECT discount_pct FROM pricing p WHERE p.rule_type='sku'      AND p.target=vis.sku        AND p.discount_pct IS NOT NULL LIMIT 1)/100.0) END,
        (SELECT fixed_price FROM pricing p WHERE p.rule_type='brand'    AND p.target=vis.brand_name AND p.fixed_price IS NOT NULL LIMIT 1),
        CASE WHEN EXISTS(SELECT 1 FROM pricing p WHERE p.rule_type='brand'    AND p.target=vis.brand_name AND p.discount_pct IS NOT NULL)
          THEN vis.base_wsp*(1-(SELECT discount_pct FROM pricing p WHERE p.rule_type='brand'    AND p.target=vis.brand_name AND p.discount_pct IS NOT NULL LIMIT 1)/100.0) END,
        (SELECT fixed_price FROM pricing p WHERE p.rule_type='category' AND p.target=vis.category   AND p.fixed_price IS NOT NULL LIMIT 1),
        CASE WHEN EXISTS(SELECT 1 FROM pricing p WHERE p.rule_type='category' AND p.target=vis.category   AND p.discount_pct IS NOT NULL)
          THEN vis.base_wsp*(1-(SELECT discount_pct FROM pricing p WHERE p.rule_type='category' AND p.target=vis.category   AND p.discount_pct IS NOT NULL LIMIT 1)/100.0) END,
        CASE WHEN EXISTS(SELECT 1 FROM pricing p WHERE p.rule_type='global'   AND p.discount_pct IS NOT NULL)
          THEN vis.base_wsp*(1-(SELECT discount_pct FROM pricing p WHERE p.rule_type='global'   AND p.discount_pct IS NOT NULL LIMIT 1)/100.0) END,
        (SELECT fixed_price FROM pricing p WHERE p.rule_type='global'   AND p.fixed_price IS NOT NULL LIMIT 1),
        vis.base_wsp
      ) AS wholesale_price
    FROM visible vis
  )
  SELECT
    p.id, p.title, p.sku, p.category, p.brand_name, p.brand_id,
    p.gender, p.color, p.season, p.line, p.tags, p.description,
    p.retail_price, p.wholesale_price, p.base_wsp, p.moq, p.delivery_window,
    p.image_urls, p.image_url, p.sizes, p.tier_pricing,
    p.inventory_status, p.stock_total, p.created_at, p.updated_at
  FROM priced p
  ORDER BY p.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_buyer_catalog(UUID) TO authenticated, anon;


-- ── get_brand_sell_through ────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_brand_sell_through(TEXT);
CREATE OR REPLACE FUNCTION public.get_brand_sell_through(p_brand_name TEXT)
RETURNS TABLE (
  inventory_id   BIGINT,
  title          TEXT,
  sku            TEXT,
  category       TEXT,
  color          TEXT,
  season         TEXT,
  line           TEXT,
  stock_total    INTEGER,
  wsp_usd        NUMERIC,
  units_ordered  BIGINT,
  revenue_usd    NUMERIC,
  order_count    BIGINT,
  sizes_ordered  JSONB
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH order_items AS (
    SELECT
      (item->>'title')                                     AS title,
      (item->>'sku')                                       AS sku,
      (item->>'colour')                                    AS colour,
      (item->>'brand_name')                                AS brand_name,
      COALESCE((item->>'qty')::int, 1)                    AS qty,
      COALESCE((item->>'wholesale_price')::numeric, 0)    AS wholesale_price,
      (item->'sizes')                                      AS sizes_json,
      bo.id                                                AS order_id
    FROM buyer_orders bo,
         jsonb_array_elements(CASE jsonb_typeof(bo.items) WHEN 'array' THEN bo.items ELSE '[]'::jsonb END) AS item
    WHERE lower(item->>'brand_name') = lower(p_brand_name)
  ),
  size_rows AS (
    SELECT oi.title, oi.sku, oi.colour, sk.key AS size_key, (sk.value::text)::int AS size_qty
    FROM order_items oi, jsonb_each(COALESCE(oi.sizes_json, '{}'::jsonb)) sk
    WHERE oi.sizes_json IS NOT NULL AND jsonb_typeof(oi.sizes_json) = 'object'
  ),
  sizes_agg AS (
    SELECT title, sku, colour, jsonb_object_agg(size_key, sum_qty ORDER BY size_key) AS sizes_ordered
    FROM (SELECT title, sku, colour, size_key, SUM(size_qty) AS sum_qty FROM size_rows GROUP BY title, sku, colour, size_key) sub
    GROUP BY title, sku, colour
  ),
  item_totals AS (
    SELECT title, sku, colour,
      SUM(qty)             AS units_ordered,
      SUM(qty*wholesale_price) AS revenue_usd,
      COUNT(DISTINCT order_id) AS order_count
    FROM order_items GROUP BY title, sku, colour
  )
  SELECT
    inv.id AS inventory_id, inv.title, inv.sku, inv.category,
    COALESCE(it.colour, inv.color, '') AS color,
    inv.season, inv.line,
    COALESCE(inv.stock_total, 0) AS stock_total,
    COALESCE(inv.wsp_usd, 0)    AS wsp_usd,
    COALESCE(it.units_ordered, 0) AS units_ordered,
    COALESCE(it.revenue_usd, 0)   AS revenue_usd,
    COALESCE(it.order_count, 0)   AS order_count,
    COALESCE(sa.sizes_ordered, '{}'::jsonb) AS sizes_ordered
  FROM inventory inv
  LEFT JOIN item_totals it ON lower(it.title) = lower(inv.title)
  LEFT JOIN sizes_agg   sa ON lower(sa.title) = lower(inv.title)
  WHERE lower(inv.brand_name) = lower(p_brand_name) AND inv.status != 'archived'
  ORDER BY it.units_ordered DESC NULLS LAST, inv.title;
$$;

GRANT EXECUTE ON FUNCTION public.get_brand_sell_through(TEXT) TO authenticated;


-- ── allocate_order_stock_v2 ───────────────────────────────────────────────────
-- Two-pass allocation:
--   IMMEDIATE          → stock on hand, decrement inventory.sizes + stock_total
--   FUTURE_ALLOCATION  → delivery_window present, accept as pre-order (no decrement)

DROP FUNCTION IF EXISTS public.allocate_order_stock_v2(JSONB);
CREATE OR REPLACE FUNCTION public.allocate_order_stock_v2(p_items JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_item          JSONB;
  v_inv           RECORD;
  v_new_sizes     JSONB;
  v_new_stock     INTEGER;
  v_sz_key        TEXT;
  v_sz_qty        INTEGER;
  v_sz_avail      INTEGER;
  v_errors        JSONB    := '[]'::JSONB;
  v_allocated     JSONB    := '[]'::JSONB;
  v_item_type     TEXT;
  v_has_immediate BOOLEAN  := FALSE;
  v_has_future    BOOLEAN  := FALSE;
  v_order_type    TEXT;
  v_stock_short   BOOLEAN;
BEGIN
  -- Pass 1: classify and validate
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    SELECT id, sku, stock_total, sizes, delivery_window
      INTO v_inv FROM public.inventory
     WHERE sku = v_item->>'sku' AND status = 'active' FOR UPDATE;

    IF NOT FOUND THEN
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('sku', v_item->>'sku', 'error', 'Product not found or inactive'));
      CONTINUE;
    END IF;

    v_stock_short := FALSE;
    FOR v_sz_key, v_sz_qty IN SELECT key, value::text::integer FROM jsonb_each_text(v_item->'sizes') WHERE value::text::integer > 0 LOOP
      v_sz_avail := COALESCE((v_inv.sizes ->> v_sz_key)::integer, 0);
      IF v_sz_avail < v_sz_qty THEN v_stock_short := TRUE; EXIT; END IF;
    END LOOP;

    IF v_stock_short THEN
      IF COALESCE(v_inv.delivery_window, v_item->>'delivery_window', '') <> '' THEN
        v_has_future := TRUE;
      ELSE
        FOR v_sz_key, v_sz_qty IN SELECT key, value::text::integer FROM jsonb_each_text(v_item->'sizes') WHERE value::text::integer > 0 LOOP
          v_sz_avail := COALESCE((v_inv.sizes ->> v_sz_key)::integer, 0);
          IF v_sz_avail < v_sz_qty THEN
            v_errors := v_errors || jsonb_build_array(jsonb_build_object(
              'sku', v_item->>'sku', 'size', v_sz_key,
              'error', 'Insufficient stock — no forward delivery window set',
              'available', v_sz_avail, 'requested', v_sz_qty));
          END IF;
        END LOOP;
        CONTINUE;
      END IF;
    ELSE
      v_has_immediate := TRUE;
    END IF;
  END LOOP;

  IF jsonb_array_length(v_errors) > 0 THEN
    RETURN jsonb_build_object('success', false, 'errors', v_errors);
  END IF;

  -- Pass 2: commit
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    SELECT id, sku, stock_total, sizes, delivery_window
      INTO v_inv FROM public.inventory WHERE sku = v_item->>'sku' FOR UPDATE;

    v_stock_short := FALSE;
    FOR v_sz_key, v_sz_qty IN SELECT key, value::text::integer FROM jsonb_each_text(v_item->'sizes') WHERE value::text::integer > 0 LOOP
      IF COALESCE((v_inv.sizes ->> v_sz_key)::integer, 0) < v_sz_qty THEN v_stock_short := TRUE; EXIT; END IF;
    END LOOP;

    IF v_stock_short AND COALESCE(v_inv.delivery_window, v_item->>'delivery_window', '') <> '' THEN
      v_allocated := v_allocated || jsonb_build_array(jsonb_build_object(
        'sku', v_inv.sku, 'fulfillment_type', 'FUTURE_ALLOCATION',
        'delivery_window', COALESCE(v_inv.delivery_window, v_item->>'delivery_window'),
        'sizes_used', v_item->'sizes', 'stock_after', NULL));
    ELSE
      v_new_sizes := v_inv.sizes;
      v_new_stock := v_inv.stock_total;
      FOR v_sz_key, v_sz_qty IN SELECT key, value::text::integer FROM jsonb_each_text(v_item->'sizes') WHERE value::text::integer > 0 LOOP
        v_new_sizes := jsonb_set(v_new_sizes, ARRAY[v_sz_key],
          to_jsonb(GREATEST(0, COALESCE((v_new_sizes ->> v_sz_key)::integer, 0) - v_sz_qty)));
        v_new_stock := v_new_stock - v_sz_qty;
      END LOOP;
      UPDATE public.inventory SET sizes = v_new_sizes, stock_total = GREATEST(0, v_new_stock) WHERE id = v_inv.id;
      v_allocated := v_allocated || jsonb_build_array(jsonb_build_object(
        'sku', v_inv.sku, 'fulfillment_type', 'IMMEDIATE',
        'sizes_used', v_item->'sizes', 'stock_after', GREATEST(0, v_new_stock)));
    END IF;
  END LOOP;

  v_order_type := CASE WHEN v_has_immediate AND v_has_future THEN 'MIXED'
                       WHEN v_has_future THEN 'FUTURE_ALLOCATION'
                       ELSE 'IMMEDIATE' END;

  RETURN jsonb_build_object('success', true, 'allocated', v_allocated, 'order_fulfillment_type', v_order_type);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'errors', jsonb_build_array(jsonb_build_object('error', SQLERRM)));
END;
$$;

GRANT EXECUTE ON FUNCTION public.allocate_order_stock_v2(JSONB) TO anon, authenticated, service_role;
