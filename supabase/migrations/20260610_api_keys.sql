-- ─────────────────────────────────────────────────────────────────────────────
-- Public /v1 API keys  (V1-API-PLAN.md · Phase 1)
-- Machine-to-machine keys for the public REST API at api.linezheets.com.
-- A key is owned by one account (a brand storefront or a buyer) and carries
-- explicit scopes. Only the SHA-256 hash is stored — the raw key is shown once.
-- Run in Supabase Dashboard → SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.api_keys (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  key_prefix    text        NOT NULL,                       -- e.g. "lz_live_AbCd" (display only)
  key_hash      text        NOT NULL UNIQUE,                -- SHA-256 hex of the full raw key
  name          text,                                       -- human label, e.g. "ERP integration"
  account_type  text        NOT NULL CHECK (account_type IN ('brand', 'buyer')),
  account_id    uuid        NOT NULL,                       -- brand_storefronts.id or buyers.id
  scopes        text[]      NOT NULL DEFAULT '{}',          -- e.g. {'products:read','orders:read'}
  environment   text        NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'test')),
  last_used_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  revoked_at    timestamptz                                 -- non-null = key rejected
);

CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON public.api_keys (key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_account  ON public.api_keys (account_type, account_id);

-- This table holds credential hashes. Enable RLS with NO permissive policy so
-- anon/authenticated clients can never read it; the API auth layer reaches it
-- only via the service-role key, which bypasses RLS.
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE  public.api_keys          IS 'Public /v1 API keys (hash-only). Service-role access only.';
COMMENT ON COLUMN public.api_keys.key_hash IS 'SHA-256 hex of the raw key; the raw key is never stored.';
