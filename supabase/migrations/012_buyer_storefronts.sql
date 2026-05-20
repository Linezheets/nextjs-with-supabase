-- Buyer-owned consumer storefronts
CREATE TABLE IF NOT EXISTS buyer_storefronts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug         TEXT NOT NULL UNIQUE,           -- URL: /store/[slug]
  name         TEXT NOT NULL,
  tagline      TEXT,
  description  TEXT,
  logo_url     TEXT,
  banner_url   TEXT,
  accent_color TEXT DEFAULT '#000000',
  contact_email TEXT,
  instagram    TEXT,
  website      TEXT,
  published    BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)                               -- one store per buyer for now
);

CREATE INDEX IF NOT EXISTS idx_storefronts_slug    ON buyer_storefronts(slug);
CREATE INDEX IF NOT EXISTS idx_storefronts_user_id ON buyer_storefronts(user_id);

-- Products published to a storefront
CREATE TABLE IF NOT EXISTS storefront_products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storefront_id   UUID NOT NULL REFERENCES buyer_storefronts(id) ON DELETE CASCADE,
  catalog_item_id TEXT NOT NULL,                -- references buyer_vip_catalog.id
  consumer_price  DECIMAL(14,2),               -- buyer sets their own retail price (or null = use brand retail)
  featured        BOOLEAN DEFAULT false,
  sort_order      INT DEFAULT 0,
  published       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(storefront_id, catalog_item_id)
);

CREATE INDEX IF NOT EXISTS idx_sf_products_storefront ON storefront_products(storefront_id);

-- Consumer enquiries from the public storefront
CREATE TABLE IF NOT EXISTS storefront_enquiries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storefront_id UUID NOT NULL REFERENCES buyer_storefronts(id) ON DELETE CASCADE,
  product_id    TEXT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  message       TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE buyer_storefronts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE storefront_products  ENABLE ROW LEVEL SECURITY;
ALTER TABLE storefront_enquiries ENABLE ROW LEVEL SECURITY;

-- Owners can do everything
CREATE POLICY "owner full access storefronts"   ON buyer_storefronts   FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "owner full access sf_products"   ON storefront_products  FOR ALL USING (
  storefront_id IN (SELECT id FROM buyer_storefronts WHERE user_id = auth.uid())
);
CREATE POLICY "owner reads enquiries"           ON storefront_enquiries FOR SELECT USING (
  storefront_id IN (SELECT id FROM buyer_storefronts WHERE user_id = auth.uid())
);

-- Public can read published storefronts and their products
CREATE POLICY "public reads published storefronts" ON buyer_storefronts  FOR SELECT USING (published = true);
CREATE POLICY "public reads published products"    ON storefront_products FOR SELECT USING (
  published = true AND storefront_id IN (SELECT id FROM buyer_storefronts WHERE published = true)
);

-- Anyone can submit enquiries
CREATE POLICY "public can enquire" ON storefront_enquiries FOR INSERT WITH CHECK (true);
