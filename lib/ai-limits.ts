// ─────────────────────────────────────────────────────────────────────────────
// Linezheets AI — in-house usage limits per plan
// ─────────────────────────────────────────────────────────────────────────────
// These govern the IN-HOUSE "Linezheets AI" (which runs on the platform's own
// Anthropic key). Bring-your-own-key usage is always unlimited (it's the user's
// own cost) and is NOT metered.
//
// Edit these numbers freely — they're the single source of truth for the quota.
// subscription_tier values come from brand_storefronts.subscription_tier
// (plan ids: 'starter', 'agent' = the $149 Brand plan, 'enterprise').
// ─────────────────────────────────────────────────────────────────────────────

export const AI_MONTHLY_LIMITS: Record<string, number> = {
  starter   : 0,     // free — bring your own key only
  free      : 0,
  brand     : 300,   // alias
  agent     : 300,   // $149 Brand plan
  enterprise: 2000,
};

/** Monthly in-house generation allowance for a plan tier (0 = not included). */
export function aiMonthlyLimit(tier: string | null | undefined): number {
  return AI_MONTHLY_LIMITS[(tier ?? 'starter').toLowerCase()] ?? 0;
}

/** Current usage period key, e.g. "2026-06" (UTC). */
export function currentPeriod(d: Date = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
