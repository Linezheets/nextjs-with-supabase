-- Buyer favorites: products and brands
CREATE TABLE IF NOT EXISTS buyer_favorites (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type  TEXT NOT NULL CHECK (item_type IN ('product', 'brand')),
  item_id    TEXT NOT NULL,          -- catalog item id or brand name slug
  item_label TEXT,                   -- human-readable name for display
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, item_type, item_id)
);

CREATE INDEX IF NOT EXISTS idx_buyer_favorites_user ON buyer_favorites(user_id);

-- Alert preferences per user
CREATE TABLE IF NOT EXISTS buyer_alert_prefs (
  user_id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_alerts     BOOLEAN DEFAULT true,
  in_app_alerts    BOOLEAN DEFAULT true,
  alert_on         TEXT[] DEFAULT ARRAY['new_stock', 'price_change', 'promotion', 'new_collection'],
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Alerts log (sent notifications)
CREATE TABLE IF NOT EXISTS buyer_alerts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type  TEXT NOT NULL,
  item_id    TEXT NOT NULL,
  item_label TEXT,
  alert_type TEXT NOT NULL,          -- new_stock | price_change | promotion | new_collection
  title      TEXT NOT NULL,
  body       TEXT,
  read       BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buyer_alerts_user ON buyer_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_buyer_alerts_read  ON buyer_alerts(user_id, read);

-- RLS
ALTER TABLE buyer_favorites     ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyer_alert_prefs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyer_alerts        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users own their favorites"   ON buyer_favorites   FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users own their prefs"       ON buyer_alert_prefs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users own their alerts"      ON buyer_alerts      FOR ALL USING (auth.uid() = user_id);
