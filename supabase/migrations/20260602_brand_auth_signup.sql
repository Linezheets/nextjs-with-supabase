-- Auto-provision a brand_storefronts row when a brand registers via Supabase Auth.
-- Mirrors the buyer pattern in 20260602_buyer_auth_signup.sql.
--
-- Also adds the `plan` column to brand_storefronts so the chosen plan
-- (starter / studio / enterprise) is persisted at signup.

-- 1. Store the subscription plan chosen at registration
ALTER TABLE public.brand_storefronts
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'studio';

-- 2. Trigger function
CREATE OR REPLACE FUNCTION public.handle_brand_auth_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company  TEXT;
  v_slug     TEXT;
  v_base     TEXT;
  v_suffix   INT := 0;
BEGIN
  IF NEW.raw_user_meta_data->>'role' <> 'brand' THEN
    RETURN NEW;
  END IF;

  v_company := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'company_name'), ''),
    SPLIT_PART(NEW.email, '@', 1)
  );

  -- Build a URL-safe slug: lowercase, spaces → hyphens, strip non-alnum/hyphen
  v_base := LOWER(REGEXP_REPLACE(v_company, '[^a-zA-Z0-9\s-]', '', 'g'));
  v_base := REGEXP_REPLACE(TRIM(v_base), '\s+', '-', 'g');
  v_base := SUBSTR(v_base, 1, 48);  -- leave room for suffix
  v_slug := v_base;

  -- Ensure uniqueness
  WHILE EXISTS (SELECT 1 FROM public.brand_storefronts WHERE slug = v_slug) LOOP
    v_suffix := v_suffix + 1;
    v_slug   := v_base || '-' || v_suffix;
  END LOOP;

  INSERT INTO public.brand_storefronts (
    user_id,
    brand_name,
    display_name,
    slug,
    contact_email,
    plan,
    published
  ) VALUES (
    NEW.id,
    v_company,
    v_company,
    v_slug,
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'plan', ''), 'studio'),
    false
  )
  ON CONFLICT (user_id) DO UPDATE
    SET brand_name    = EXCLUDED.brand_name,
        display_name  = EXCLUDED.display_name,
        contact_email = EXCLUDED.contact_email,
        plan          = EXCLUDED.plan,
        updated_at    = NOW();

  RETURN NEW;
END;
$$;

-- 3. Attach to auth.users
DROP TRIGGER IF EXISTS trg_brand_auth_signup ON auth.users;
CREATE TRIGGER trg_brand_auth_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_brand_auth_signup();
