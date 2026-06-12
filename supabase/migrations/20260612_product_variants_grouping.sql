-- ─────────────────────────────────────────────────────────────────────────────
-- Wix-parity product editor — grouped-colourway variant model
-- ─────────────────────────────────────────────────────────────────────────────
-- Design: a "product" in the new editor is a GROUP of public.inventory rows, one
-- per colourway, tied together by `style_id`. Each colourway row keeps its own
-- sku + `sizes` JSONB (per-size stock) + image_urls, so the existing stock engine
-- (allocate_order_stock_v2, keyed on sku + sizes) and every consumer that reads a
-- catalog row keep working UNCHANGED. This gives per-colour AND per-size inventory
-- without a separate variants table.
--
-- This migration is additive and idempotent (safe to re-run, safe on prod).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Group colourways of the same style. NULL = ungrouped (treat the row as its
--    own one-colour group via COALESCE(style_id, id::text) in reads).
--    TEXT (not UUID) so this is safe whether inventory.id is UUID or integer —
--    the canonical schema says UUID but legacy DBs use BIGSERIAL, and the app
--    code (parseInt on the id) implies the live table is integer-keyed.
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS style_id TEXT;

-- 2. Hex for the colour swatch in the editor / storefront swatches (cf. the
--    originally-intended product_variants.color_hex). NULL = no swatch colour.
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS color_hex TEXT;

-- 3. Video media, parallel to the existing image_urls TEXT[]. Kept as a separate
--    array (rather than reshaping image_urls) so every consumer that reads
--    image_urls is untouched. Ordered; [1] = primary video.
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS video_urls TEXT[] NOT NULL DEFAULT '{}';

-- 4. Backfill: every existing product becomes its own single-colour style group.
UPDATE public.inventory SET style_id = id::text WHERE style_id IS NULL;

-- 5. Keep new rows self-grouped by default if the writer forgets to set style_id.
--    (A DEFAULT can't reference another column, so use a BEFORE INSERT trigger.)
CREATE OR REPLACE FUNCTION public.inventory_default_style_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.style_id IS NULL THEN
    NEW.style_id := NEW.id::text;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_default_style_id ON public.inventory;
CREATE TRIGGER trg_inventory_default_style_id
  BEFORE INSERT ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION public.inventory_default_style_id();

-- 6. Index for grouped reads (editor reopen, storefront colour-swatch grouping).
CREATE INDEX IF NOT EXISTS idx_inventory_style_id ON public.inventory(style_id);

-- 7. Widen the product-images storage bucket to accept video, so colourway videos
--    can use the same bucket as images. Idempotent.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
      'image/jpeg','image/png','image/webp','image/gif','image/bmp','image/tiff','image/avif',
      'video/mp4','video/webm','video/quicktime'
    ],
    file_size_limit = 52428800   -- 50 MB to allow short product videos
WHERE id = 'product-images';
