-- ─────────────────────────────────────────────────────────────────────────────
-- Linezheets AI — in-house usage metering
-- ─────────────────────────────────────────────────────────────────────────────
-- One row per in-house ("Linezheets AI") generation, so we can enforce the
-- per-plan monthly quota (see lib/ai-limits.ts) and never let the platform's
-- Anthropic key be burned unmetered. Bring-your-own-key usage is NOT recorded.
-- Additive + idempotent — safe to run on prod.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_usage (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL,
  brand_name  TEXT,
  period      TEXT        NOT NULL,          -- 'YYYY-MM' (UTC)
  task        TEXT,
  provider    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user_period ON public.ai_usage(user_id, period);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

-- Users may read their own usage (for the "x / limit used" meter). Writes happen
-- server-side with the service/secret key, which bypasses RLS.
DROP POLICY IF EXISTS ai_usage_select_own ON public.ai_usage;
CREATE POLICY ai_usage_select_own ON public.ai_usage
  FOR SELECT USING (auth.uid() = user_id);
