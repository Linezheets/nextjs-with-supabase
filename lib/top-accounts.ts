// ── Types ─────────────────────────────────────────────────────────────────────

export type AccountTier = 'platinum' | 'gold' | 'silver' | 'rising';

export type TopAccount = {
  id            : string;
  email         : string;
  store_name    : string;
  city          : string | null;
  country       : string;
  tier          : AccountTier;
  score         : number;         // 0-100 composite
  score_breakdown: ScoreBreakdown;
  // from buyer_analysis
  total_spend   : number;
  total_orders  : number;
  avg_order_value: number;
  // from recommendation sends
  best_match_score: number;
  // display
  has_brand_affinity: boolean;
};

export type ScoreBreakdown = {
  affinity : number;   // 0-35
  match    : number;   // 0-25
  spend    : number;   // 0-25
  loyalty  : number;   // 0-15
};

type BuyerRow = {
  id            : string;
  email         : string;
  store_name    : string;
  city          : string | null;
  country       : string;
  status        : string;
};

type AnalysisRow = {
  buyer_id        : string;
  brand_affinities: string[];
  total_spend     : number | null;
  total_orders    : number | null;
  avg_order_value : number | null;
};

type SendRow = {
  buyer_id    : string;
  match_score : number;
};

// ── Tier thresholds ───────────────────────────────────────────────────────────

export const TIER_THRESHOLDS: Record<AccountTier, number> = {
  platinum: 72,
  gold    : 50,
  silver  : 28,
  rising  : 0,
};

export function getTier(score: number): AccountTier {
  if (score >= TIER_THRESHOLDS.platinum) return 'platinum';
  if (score >= TIER_THRESHOLDS.gold)     return 'gold';
  if (score >= TIER_THRESHOLDS.silver)   return 'silver';
  return 'rising';
}

export const TIER_LABELS: Record<AccountTier, string> = {
  platinum: 'Platinum',
  gold    : 'Gold',
  silver  : 'Silver',
  rising  : 'Rising',
};

export const TIER_COLORS: Record<AccountTier, string> = {
  platinum: '#c9a84c',
  gold    : '#e8a838',
  silver  : '#a0a0a0',
  rising  : '#7cb9e8',
};

// ── Scoring ───────────────────────────────────────────────────────────────────

function percentileScore(value: number, max: number, weight: number): number {
  if (!max || !value) return 0;
  return Math.round(Math.min(value / max, 1) * weight);
}

export function scoreAccounts(
  buyers  : BuyerRow[],
  analyses: AnalysisRow[],
  sends   : SendRow[],
  brandName: string,
): TopAccount[] {
  const analysisMap = Object.fromEntries(analyses.map(a => [a.buyer_id, a]));
  const sendsMap: Record<string, number> = {};
  for (const s of sends) {
    sendsMap[s.buyer_id] = Math.max(sendsMap[s.buyer_id] ?? 0, s.match_score);
  }

  // Compute per-buyer raw values first so we can normalise
  type RawBuyer = BuyerRow & {
    analysis       : AnalysisRow | undefined;
    best_match     : number;
    has_affinity   : boolean;
    total_spend    : number;
    total_orders   : number;
    avg_order_value: number;
  };

  const raw: RawBuyer[] = buyers.map(b => {
    const analysis     = analysisMap[b.id];
    const best_match   = sendsMap[b.id] ?? 0;
    const has_affinity = (analysis?.brand_affinities ?? [])
      .some(a => a.toLowerCase().includes(brandName.toLowerCase()));

    return {
      ...b,
      analysis,
      best_match,
      has_affinity,
      total_spend    : Number(analysis?.total_spend    ?? 0),
      total_orders   : Number(analysis?.total_orders   ?? 0),
      avg_order_value: Number(analysis?.avg_order_value ?? 0),
    };
  });

  // Find normalisation maxima
  const maxSpend = Math.max(1, ...raw.map(b => b.total_spend));
  const maxOrders = Math.max(1, ...raw.map(b => b.total_orders));

  return raw.map(b => {
    const affinity = b.has_affinity ? 35 : 0;
    const match    = Math.round((b.best_match / 100) * 25);
    const spend    = percentileScore(b.total_spend,  maxSpend,  25);
    const loyalty  = percentileScore(b.total_orders, maxOrders, 15);

    const score    = Math.min(100, affinity + match + spend + loyalty);
    const tier     = getTier(score);

    return {
      id             : b.id,
      email          : b.email,
      store_name     : b.store_name,
      city           : b.city,
      country        : b.country,
      tier,
      score,
      score_breakdown: { affinity, match, spend, loyalty },
      total_spend    : b.total_spend,
      total_orders   : b.total_orders,
      avg_order_value: b.avg_order_value,
      best_match_score: b.best_match,
      has_brand_affinity: b.has_affinity,
    };
  })
  .filter(b => b.score > 0)
  .sort((a, b) => b.score - a.score);
}

// ── Tier eligibility helpers ──────────────────────────────────────────────────

export function tierMeetsMinimum(tier: AccountTier, minTier: string): boolean {
  const order: AccountTier[] = ['rising', 'silver', 'gold', 'platinum'];
  return order.indexOf(tier) >= order.indexOf(minTier as AccountTier);
}
