-- Brand-owned consumer storefronts (retail-facing, no wholesale pricing)
CREATE TABLE IF NOT EXISTS brand_storefronts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_name      TEXT NOT NULL,                -- matches inventory.brand_name
  slug            TEXT NOT NULL UNIQUE,         -- /brand/[slug]
  display_name    TEXT NOT NULL,
  tagline         TEXT,
  description     TEXT,
  logo_url        TEXT,
  banner_url      TEXT,
  contact_email   TEXT,
  instagram       TEXT,
  website         TEXT,
  custom_domain   TEXT,
  domain_verified BOOLEAN DEFAULT false,
  published       BOOLEAN DEFAULT false,
  theme           JSONB DEFAULT '{
    "font_heading": "serif",
    "font_body": "sans",
    "color_accent": "#111111",
    "color_bg": "#ffffff",
    "color_text": "#111111",
    "color_surface": "#f9f9f9",
    "sections": [
      { "id": "hero",     "type": "hero",              "enabled": true, "headline": "Our Collection", "subheadline": "Explore our latest pieces.", "cta_label": "Shop Now", "cta_link": "#collection", "bg_color": "#0a0a0a", "text_color": "#ffffff" },
      { "id": "featured", "type": "featured_products",  "enabled": true, "title": "New Arrivals", "count": 8, "layout": "grid" },
      { "id": "about",    "type": "about",              "enabled": false, "heading": "About the Brand", "body": "" },
      { "id": "contact",  "type": "contact",            "enabled": true, "heading": "Get in Touch" }
    ]
  }'::jsonb,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_brand_storefronts_slug        ON brand_storefronts(slug);
CREATE INDEX IF NOT EXISTS idx_brand_storefronts_user_id     ON brand_storefronts(user_id);
CREATE INDEX IF NOT EXISTS idx_brand_storefronts_brand_name  ON brand_storefronts(brand_name);

-- Products published to a brand storefront
CREATE TABLE IF NOT EXISTS brand_storefront_products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storefront_id   UUID NOT NULL REFERENCES brand_storefronts(id) ON DELETE CASCADE,
  inventory_id    INT NOT NULL,                 -- references inventory.id
  consumer_price  DECIMAL(14,2),               -- override SRP if desired
  featured        BOOLEAN DEFAULT false,
  sort_order      INT DEFAULT 0,
  published       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(storefront_id, inventory_id)
);

CREATE INDEX IF NOT EXISTS idx_brand_sf_products_storefront ON brand_storefront_products(storefront_id);

-- Consumer enquiries
CREATE TABLE IF NOT EXISTS brand_storefront_enquiries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storefront_id UUID NOT NULL REFERENCES brand_storefronts(id) ON DELETE CASCADE,
  inventory_id  INT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  message       TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE brand_storefronts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_storefront_products   ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_storefront_enquiries  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner brand storefronts"   ON brand_storefronts          FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "owner brand sf products"   ON brand_storefront_products   FOR ALL USING (
  storefront_id IN (SELECT id FROM brand_storefronts WHERE user_id = auth.uid())
);
CREATE POLICY "owner reads brand enquiries" ON brand_storefront_enquiries FOR SELECT USING (
  storefront_id IN (SELECT id FROM brand_storefronts WHERE user_id = auth.uid())
);
CREATE POLICY "public reads published brand storefronts" ON brand_storefronts        FOR SELECT USING (published = true);
CREATE POLICY "public reads published brand products"    ON brand_storefront_products FOR SELECT USING (
  published = true AND storefront_id IN (SELECT id FROM brand_storefronts WHERE published = true)
);
CREATE POLICY "public can enquire brand"  ON brand_storefront_enquiries  FOR INSERT WITH CHECK (true);
