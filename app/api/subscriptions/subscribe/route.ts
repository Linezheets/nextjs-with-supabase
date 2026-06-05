import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import stripe from '@/lib/stripe';

const PRICE_MAP: Record<string, { monthly: string | undefined; annual: string | undefined }> = {
  starter: {
    monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY,
    annual : process.env.STRIPE_PRICE_STARTER_ANNUAL,
  },
  agent: {
    monthly: process.env.STRIPE_PRICE_AGENT_MONTHLY,
    annual : process.env.STRIPE_PRICE_AGENT_ANNUAL,
  },
  enterprise: {
    monthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY,
    annual : process.env.STRIPE_PRICE_ENTERPRISE_ANNUAL,
  },
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { tier, billing = 'monthly', paymentMethodId } = await req.json() as {
    tier           : string;
    billing?       : 'monthly' | 'annual';
    paymentMethodId?: string;
  };

  if (!PRICE_MAP[tier]) {
    return NextResponse.json({ error: 'Invalid tier. Choose: starter, agent, enterprise' }, { status: 400 });
  }

  const priceId = PRICE_MAP[tier][billing as 'monthly' | 'annual'];
  if (!priceId) {
    return NextResponse.json({ error: `No Stripe price configured for ${tier}/${billing}` }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: sf } = await admin
    .from('brand_storefronts')
    .select('id, brand_name, stripe_customer_id, stripe_subscription_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!sf) return NextResponse.json({ error: 'Brand storefront not found' }, { status: 404 });

  let customerId: string = sf.stripe_customer_id ?? '';

  if (!customerId) {
    const customer = await stripe.customers.create({
      email   : user.email ?? undefined,
      metadata: { supabase_user_id: user.id, brand_name: sf.brand_name },
    });
    customerId = customer.id;
    await admin
      .from('brand_storefronts')
      .update({ stripe_customer_id: customerId })
      .eq('id', sf.id);
  }

  if (paymentMethodId) {
    await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });
  }

  // Cancel existing subscription before creating new one
  if (sf.stripe_subscription_id) {
    await stripe.subscriptions.cancel(sf.stripe_subscription_id).catch(() => {});
  }

  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items   : [{ price: priceId }],
    expand  : ['latest_invoice.payment_intent'],
    metadata: { supabase_user_id: user.id, brand_name: sf.brand_name, tier },
  });

  const now = new Date().toISOString();

  await Promise.all([
    admin.from('brand_storefronts').update({
      subscription_tier      : tier,
      subscription_status    : subscription.status,
      stripe_subscription_id : subscription.id,
      stripe_customer_id     : customerId,
      updated_at             : now,
    }).eq('id', sf.id),

    admin.from('brand_subscriptions').upsert({
      brand_user_id          : user.id,
      tier,
      status                 : subscription.status,
      billing_cycle          : billing,
      stripe_customer_id     : customerId,
      stripe_subscription_id : subscription.id,
      current_period_start   : new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end     : new Date(subscription.current_period_end * 1000).toISOString(),
      updated_at             : now,
    }, { onConflict: 'stripe_subscription_id' }),
  ]);

  const invoice = subscription.latest_invoice as { payment_intent?: { client_secret?: string } } | null;

  return NextResponse.json({
    subscription: { id: subscription.id, status: subscription.status, tier },
    clientSecret: invoice?.payment_intent?.client_secret ?? null,
  });
}
