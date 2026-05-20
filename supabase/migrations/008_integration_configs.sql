CREATE TABLE IF NOT EXISTS integration_configs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id     TEXT NOT NULL,
  platform     TEXT NOT NULL,
  access_token TEXT,
  shop_domain  TEXT,
  external_id  TEXT,
  config       JSONB DEFAULT '{}',
  active       BOOLEAN DEFAULT true,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  last_sync_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(brand_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_integration_configs_brand_id ON integration_configs(brand_id);
CREATE INDEX IF NOT EXISTS idx_integration_configs_platform ON integration_configs(platform);
