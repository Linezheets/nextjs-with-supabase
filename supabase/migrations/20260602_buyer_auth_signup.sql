-- Link public.buyers to Supabase Auth users created via self-registration.
-- Adds auth_user_id FK, relaxes password_hash (Auth owns credentials now),
-- and installs a trigger that auto-creates a buyers row on auth.users INSERT
-- when raw_user_meta_data->>'role' = 'buyer'.

-- 1. Allow existing admin-created rows to have no auth user
ALTER TABLE public.buyers
  ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. password_hash is no longer required for Auth-managed accounts
ALTER TABLE public.buyers
  ALTER COLUMN password_hash DROP NOT NULL,
  ALTER COLUMN password_hash SET DEFAULT '';

-- 3. Trigger function
CREATE OR REPLACE FUNCTION public.handle_buyer_auth_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.raw_user_meta_data->>'role' = 'buyer' THEN
    INSERT INTO public.buyers (
      auth_user_id,
      email,
      store_name,
      password_hash,
      temp_password,
      status,
      first_name,
      last_name,
      phone,
      registered_by
    ) VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NULLIF(NEW.raw_user_meta_data->>'company_name', ''), NEW.email),
      '',
      false,
      'active',
      NEW.raw_user_meta_data->>'first_name',
      NEW.raw_user_meta_data->>'last_name',
      NEW.raw_user_meta_data->>'phone',
      'self'
    )
    ON CONFLICT (email) DO UPDATE
      SET auth_user_id = EXCLUDED.auth_user_id,
          first_name   = COALESCE(EXCLUDED.first_name, public.buyers.first_name),
          last_name    = COALESCE(EXCLUDED.last_name,  public.buyers.last_name),
          phone        = COALESCE(EXCLUDED.phone,       public.buyers.phone),
          updated_at   = NOW();
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Attach trigger to auth.users
DROP TRIGGER IF EXISTS trg_buyer_auth_signup ON auth.users;
CREATE TRIGGER trg_buyer_auth_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_buyer_auth_signup();

-- 5. Index for lookups by auth_user_id
CREATE INDEX IF NOT EXISTS idx_buyers_auth_user_id ON public.buyers (auth_user_id);
