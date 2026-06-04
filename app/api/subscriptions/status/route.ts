import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

const TIER_LIMITS: Record<string, { max_products: number; ai_features: boolean; marketplace: boolean }> = {
  starter   : { max_products: 50,  ai_features: false, marketplace: false },
  studio    : { max_products: -1,  ai_features: true,  marketplace: true  },
  enterprise: { max_products: -1,  ai_features: true,  marketplace: true  },
};

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: sf } = await admin
    .from('brand_storefronts')
    .select('subscription_tier, subscription_status, stripe_subscription_id, stripe_account_status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!sf) return NextResponse.json({ error: 'Brand storefront not found' }, { status: 404 });

  const tier   = sf.subscription_tier ?? 'starter';
  const limits = TIER_LIMITS[tier] ?? TIER_LIMITS.starter;

  // Fetch detailed subscription record if available
  let subscriptionDetail = null;
  if (sf.stripe_subscription_id) {
    const { data: sub } = await admin
      .from('brand_subscriptions')
      .select('tier, status, billing_cycle, current_period_start, current_period_end, cancel_at_period_end')
      .eq('stripe_subscription_id', sf.stripe_subscription_id)
      .maybeSingle();
    subscriptionDetail = sub;
  }

  return NextResponse.json({
    tier,
    status             : sf.subscription_status ?? 'trialing',
    stripe_account_status: sf.stripe_account_status,
    limits,
    subscription       : subscriptionDetail,
  });
}
