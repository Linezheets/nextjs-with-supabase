import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import stripe from '@/lib/stripe';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: sf } = await admin
    .from('brand_storefronts')
    .select('id, stripe_subscription_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!sf?.stripe_subscription_id) {
    return NextResponse.json({ error: 'No active subscription' }, { status: 400 });
  }

  const sub = await stripe.subscriptions.update(sf.stripe_subscription_id, {
    cancel_at_period_end: true,
  });

  const endsAt = new Date(sub.cancel_at! * 1000).toISOString();
  const now    = new Date().toISOString();

  await Promise.all([
    admin.from('brand_storefronts').update({
      subscription_status: 'canceled',
      updated_at         : now,
    }).eq('id', sf.id),

    admin.from('brand_subscriptions').update({
      status              : 'canceled',
      cancel_at_period_end: true,
      canceled_at         : now,
      updated_at          : now,
    }).eq('stripe_subscription_id', sf.stripe_subscription_id),
  ]);

  return NextResponse.json({
    message: 'Subscription will cancel at end of billing period',
    endsAt,
  });
}
