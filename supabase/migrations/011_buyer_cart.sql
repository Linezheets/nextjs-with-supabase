-- Persistent cart items per buyer
CREATE TABLE IF NOT EXISTS buyer_cart (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id       TEXT NOT NULL,
  brand_name    TEXT,
  title         TEXT,
  style_number  TEXT,
  colour        TEXT,
  image_url     TEXT,
  retail_price  DECIMAL(14,2),
  wholesale_price DECIMAL(14,2),
  sizes         JSONB DEFAULT '{}',   -- { "S": 2, "M": 3, "L": 1, "OS": 0 }
  qty           INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_buyer_cart_user ON buyer_cart(user_id);

ALTER TABLE buyer_cart ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own their cart" ON buyer_cart FOR ALL USING (auth.uid() = user_id);

-- RLS for buyer_orders (was missing)
ALTER TABLE buyer_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own their orders" ON buyer_orders FOR ALL USING (auth.uid()::text = buyer_id::text);
