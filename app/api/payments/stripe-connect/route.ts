import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import stripe from '@/lib/stripe';

// POST — initiate Stripe Connect onboarding for the authenticated brand
export async function POST(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: sf } = await admin
    .from('brand_storefronts')
    .select('id, brand_name, stripe_account_id, stripe_account_status')
    .eq('user_id', user.id)
    .maybeSingle() as {
      data: {
        id                   : string;
        brand_name           : string;
        stripe_account_id    : string | null;
        stripe_account_status: string | null;
      } | null;
    };

  if (!sf) return NextResponse.json({ error: 'Brand storefront not found' }, { status: 404 });

  let accountId = sf.stripe_account_id;

  if (!accountId) {
    // Create a new Express Connect account
    const account = await stripe.accounts.create({
      type        : 'express',
      email       : user.email ?? undefined,
      capabilities: {
        card_payments: { requested: true },
        transfers    : { requested: true },
      },
      metadata: { brand_name: sf.brand_name, supabase_user_id: user.id },
    });

    accountId = account.id;

    await admin
      .from('brand_storefronts')
      .update({ stripe_account_id: accountId, stripe_account_status: 'pending' })
      .eq('id', sf.id);
  }

  const frontendUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.FRONTEND_URL ?? '';

  const accountLink = await stripe.accountLinks.create({
    account    : accountId,
    refresh_url: `${frontendUrl}/dashboard/brand-store/payment-terms?stripe=refresh`,
    return_url : `${frontendUrl}/dashboard/brand-store/payment-terms?stripe=success`,
    type       : 'account_onboarding',
  });

  return NextResponse.json({ url: accountLink.url, account_id: accountId });
}

// GET — return Connect account status for the authenticated brand
export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: sf } = await admin
    .from('brand_storefronts')
    .select('stripe_account_id, stripe_account_status')
    .eq('user_id', user.id)
    .maybeSingle() as { data: { stripe_account_id: string | null; stripe_account_status: string | null } | null };

  if (!sf?.stripe_account_id) {
    return NextResponse.json({ connected: false, status: 'not_connected' });
  }

  // Re-check live status from Stripe
  try {
    const account = await stripe.accounts.retrieve(sf.stripe_account_id);
    const status  = account.charges_enabled ? 'active' : 'pending';

    if (status !== sf.stripe_account_status) {
      await admin
        .from('brand_storefronts')
        .update({ stripe_account_status: status })
        .eq('stripe_account_id', sf.stripe_account_id);
    }

    return NextResponse.json({
      connected      : true,
      status,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
    });
  } catch {
    return NextResponse.json({ connected: false, status: 'error' });
  }
}
