-- ─────────────────────────────────────────────────────────────────────────────
-- Linezheets — 006 · Supabase Storage setup for product images
-- Run once in: Supabase Dashboard → SQL Editor → New query → Run
--
-- Creates the "product-images" public bucket and the RLS policies that allow:
--   • Public READ  — buyers see product images without authentication
--   • Auth WRITE   — only authenticated (brand) users can upload / delete
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Create bucket (idempotent) ────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,                                      -- public: direct CDN URLs, no auth needed
  10485760,                                  -- 10 MB per file
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp',
    'image/gif',  'image/bmp', 'image/tiff', 'image/avif'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public            = EXCLUDED.public,
  file_size_limit   = EXCLUDED.file_size_limit,
  allowed_mime_types= EXCLUDED.allowed_mime_types;

-- ── 2. Public read policy ─────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'product-images public read'
  ) THEN
    CREATE POLICY "product-images public read"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'product-images');
    RAISE NOTICE '✓ Public read policy created';
  ELSE
    RAISE NOTICE '— Public read policy already exists';
  END IF;
END $$;

-- ── 3. Authenticated insert (brand upload) ────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'product-images auth insert'
  ) THEN
    CREATE POLICY "product-images auth insert"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'product-images'
        AND auth.role() = 'authenticated'
      );
    RAISE NOTICE '✓ Auth insert policy created';
  ELSE
    RAISE NOTICE '— Auth insert policy already exists';
  END IF;
END $$;

-- ── 4. Authenticated update ───────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'product-images auth update'
  ) THEN
    CREATE POLICY "product-images auth update"
      ON storage.objects FOR UPDATE
      USING (
        bucket_id = 'product-images'
        AND auth.role() = 'authenticated'
      );
    RAISE NOTICE '✓ Auth update policy created';
  ELSE
    RAISE NOTICE '— Auth update policy already exists';
  END IF;
END $$;

-- ── 5. Authenticated delete ───────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'product-images auth delete'
  ) THEN
    CREATE POLICY "product-images auth delete"
      ON storage.objects FOR DELETE
      USING (
        bucket_id = 'product-images'
        AND auth.role() = 'authenticated'
      );
    RAISE NOTICE '✓ Auth delete policy created';
  ELSE
    RAISE NOTICE '— Auth delete policy already exists';
  END IF;
END $$;

-- ── 6. Service-role bypass (server-side import pipeline) ─────────────────────
-- The server uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS entirely.
-- No extra policy needed — service role is superuser for storage.

-- ── 7. Verify ────────────────────────────────────────────────────────────────
SELECT
  id,
  name,
  public,
  pg_size_pretty(file_size_limit::bigint) AS max_file_size,
  allowed_mime_types
FROM storage.buckets
WHERE id = 'product-images';

SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname LIKE 'product-images%'
ORDER BY policyname;
