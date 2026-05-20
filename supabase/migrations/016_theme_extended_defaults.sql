-- ─────────────────────────────────────────────────────────────────────────────
-- Linezheets — extend theme JSONB defaults for buyer_storefronts +
-- brand_storefronts to include all new v2 theme fields.
-- Safe to run repeatedly (uses jsonb_strip_nulls + coalesce pattern).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Buyer storefronts: merge new fields into existing theme JSONB
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

-- 2. Brand storefronts: same treatment
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

-- 3. Update the column DEFAULT on buyer_storefronts so new stores get all fields
ALTER TABLE public.buyer_storefronts
  ALTER COLUMN theme SET DEFAULT '{
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
    "sections": []
  }'::jsonb;

ALTER TABLE public.brand_storefronts
  ALTER COLUMN theme SET DEFAULT '{
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
    "sections": []
  }'::jsonb;
