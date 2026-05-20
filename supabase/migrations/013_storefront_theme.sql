ALTER TABLE buyer_storefronts
  ADD COLUMN IF NOT EXISTS custom_domain  TEXT,
  ADD COLUMN IF NOT EXISTS domain_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS theme          JSONB DEFAULT '{
    "font_heading": "serif",
    "font_body": "sans",
    "color_accent": "#c9a84c",
    "color_bg": "#ffffff",
    "color_text": "#111111",
    "color_surface": "#f9f9f9",
    "sections": [
      { "id": "hero",     "type": "hero",              "enabled": true, "headline": "Our Collection", "subheadline": "Curated pieces from the finest houses.", "cta_label": "Shop Now", "cta_link": "#collection", "bg_color": "#0a0a0a", "text_color": "#ffffff" },
      { "id": "featured", "type": "featured_products",  "enabled": true, "title": "New Arrivals", "count": 8, "layout": "grid" },
      { "id": "about",    "type": "about",              "enabled": false, "heading": "Our Story", "body": "Tell your customers who you are." },
      { "id": "brands",   "type": "brands_bar",         "enabled": true  },
      { "id": "contact",  "type": "contact",            "enabled": true, "heading": "Get in Touch" }
    ]
  }'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_storefronts_custom_domain ON buyer_storefronts(custom_domain) WHERE custom_domain IS NOT NULL;
