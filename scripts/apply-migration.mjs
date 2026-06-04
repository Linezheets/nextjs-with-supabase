/**
 * Apply a raw SQL migration to Supabase using the Management API.
 *
 * Usage:
 *   SUPABASE_PAT=sbp_xxx node scripts/apply-migration.mjs
 *
 * Get a PAT at: https://app.supabase.com/account/tokens
 *
 * Alternatively, paste the SQL below directly in:
 *   https://app.supabase.com/project/xvoemjakdsihgzfddtjx/sql/new
 */

const PROJECT_REF = 'xvoemjakdsihgzfddtjx';
const PAT = process.env.SUPABASE_PAT;

const SQL = `
-- ── brand_storefronts: add plan column ────────────────────────────────────
ALTER TABLE public.brand_storefronts
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'studio';

-- ── Trigger function ──────────────────────────────────────────────────────
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
  IF (NEW.raw_user_meta_data->>'role') IS DISTINCT FROM 'brand' THEN
    RETURN NEW;
  END IF;

  v_company := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'company_name'), ''),
    SPLIT_PART(NEW.email, '@', 1)
  );

  v_base := LOWER(REGEXP_REPLACE(v_company, '[^a-zA-Z0-9\\s-]', '', 'g'));
  v_base := REGEXP_REPLACE(TRIM(v_base), '\\s+', '-', 'g');
  v_base := SUBSTR(v_base, 1, 48);
  v_slug := v_base;

  WHILE EXISTS (SELECT 1 FROM public.brand_storefronts WHERE slug = v_slug) LOOP
    v_suffix := v_suffix + 1;
    v_slug   := v_base || '-' || v_suffix;
  END LOOP;

  INSERT INTO public.brand_storefronts (
    user_id, brand_name, display_name, slug, contact_email, plan, published
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

-- ── Attach trigger ────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_brand_auth_signup ON auth.users;
CREATE TRIGGER trg_brand_auth_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_brand_auth_signup();
`;

if (!PAT) {
  console.log('\n⚠️  No SUPABASE_PAT env var set.\n');
  console.log('Option A — run with a PAT:');
  console.log('  SUPABASE_PAT=sbp_xxx node scripts/apply-migration.mjs\n');
  console.log('Option B — paste this SQL into the Supabase SQL Editor:');
  console.log('  https://app.supabase.com/project/xvoemjakdsihgzfddtjx/sql/new\n');
  console.log('─'.repeat(60));
  console.log(SQL);
  console.log('─'.repeat(60));
  process.exit(0);
}

const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
  method : 'POST',
  headers: {
    'Authorization': `Bearer ${PAT}`,
    'Content-Type' : 'application/json',
  },
  body: JSON.stringify({ query: SQL }),
});

const body = await res.text();
if (!res.ok) {
  console.error('❌  Migration failed:', res.status, body);
  process.exit(1);
}
console.log('✅  Migration applied successfully.');
console.log(body);
