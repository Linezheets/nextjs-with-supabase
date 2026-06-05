import { createAdminClient } from '@/lib/supabase/server';

// Commission rates by subscription tier (platform fee deducted via Stripe application_fee_amount)
const TIER_RATES: Record<string, number> = {
  starter   : 0.05,   // 5%
  studio    : 0.03,   // 3%
  enterprise: 0.02,   // 2%
};

const FALLBACK_RATE = parseFloat(process.env.PLATFORM_COMMISSION_RATE ?? '3') / 100;

/**
 * Resolves the platform commission rate for a brand storefront.
 *
 * - agency_managed brands: use their explicit commission_rate column
 *   (agreed between MXLLA and the brand).
 * - subscription brands: use the rate for their subscription_tier.
 * - Falls back to PLATFORM_COMMISSION_RATE env var if nothing else matches.
 */
export async function resolveCommissionRate(brandStorefrontId: string): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: sf } = await admin
    .from('brand_storefronts')
    .select('account_type, commission_rate, subscription_tier')
    .eq('id', brandStorefrontId)
    .maybeSingle() as {
      data: {
        account_type     : 'subscription' | 'agency_managed' | null;
        commission_rate  : number | null;
        subscription_tier: string | null;
      } | null;
    };

  if (!sf) return FALLBACK_RATE;

  if (sf.account_type === 'agency_managed' && sf.commission_rate != null) {
    return sf.commission_rate;
  }

  const tier = sf.subscription_tier ?? 'starter';
  return TIER_RATES[tier] ?? FALLBACK_RATE;
}

/**
 * Resolves commission rate by brand_name (used in payment routes that only have the name).
 */
export async function resolveCommissionRateByName(brandName: string): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: sf } = await admin
    .from('brand_storefronts')
    .select('id, account_type, commission_rate, subscription_tier')
    .eq('brand_name', brandName)
    .maybeSingle() as {
      data: {
        id               : string;
        account_type     : 'subscription' | 'agency_managed' | null;
        commission_rate  : number | null;
        subscription_tier: string | null;
      } | null;
    };

  if (!sf) return FALLBACK_RATE;

  if (sf.account_type === 'agency_managed' && sf.commission_rate != null) {
    return sf.commission_rate;
  }

  const tier = sf.subscription_tier ?? 'starter';
  return TIER_RATES[tier] ?? FALLBACK_RATE;
}
