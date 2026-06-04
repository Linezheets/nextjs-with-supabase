import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import stripe from '@/lib/stripe';

const PLATFORM_FEE_RATE = parseFloat(process.env.PLATFORM_COMMISSION_RATE ?? '3') / 100;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { order_id, method, flow } = await req.json() as {
    order_id: string;
    method  : 'card' | 'ach' | 'wire';
    flow    : 'immediate' | 'pay_later' | 'installments';
  };

  if (!order_id || !method) {
    return NextResponse.json({ error: 'order_id and method required' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  // Verify order belongs to this buyer
  const { data: order } = await admin
    .from('buyer_orders')
    .select('id, total_usd, stripe_customer_id, items')
    .eq('id', order_id)
    .eq('buyer_id', user.id)
    .single() as { data: { id: string; total_usd: number; stripe_customer_id: string | null; items: { brand_name?: string | null }[] } | null };

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  // Resolve brand's Stripe Connect account from the first item's brand_name
  const brandName: string | null = Array.isArray(order.items) ? (order.items[0]?.brand_name ?? null) : null;

  let stripeAccountId: string | null = null;
  if (brandName) {
    const { data: sf } = await admin
      .from('brand_storefronts')
      .select('stripe_account_id, stripe_account_status')
      .eq('brand_name', brandName)
      .maybeSingle() as { data: { stripe_account_id: string | null; stripe_account_status: string | null } | null };

    stripeAccountId = sf?.stripe_account_id ?? null;
    if (stripeAccountId && sf?.stripe_account_status !== 'active') {
      return NextResponse.json({ error: 'Brand has not completed Stripe onboarding' }, { status: 400 });
    }
  }

  if (!stripeAccountId) {
    return NextResponse.json({ error: 'Brand has not connected Stripe — cannot accept payment' }, { status: 400 });
  }

  // Get or create Stripe Customer for this buyer
  let stripeCustomerId: string = order.stripe_customer_id ?? '';
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email   : user.email ?? undefined,
      metadata: { supabase_user_id: user.id },
    });
    stripeCustomerId = customer.id;
    await admin
      .from('buyer_orders')
      .update({ stripe_customer_id: stripeCustomerId })
      .eq('id', order_id);
  }

  const amountCents = Math.round((order.total_usd ?? 0) * 100);
  const platformFee = Math.round(amountCents * PLATFORM_FEE_RATE);

  // ── Wire / SEPA via Stripe Customer Balance bank transfer ─────────────────
  if (method === 'wire') {
    const pi = await stripe.paymentIntents.create({
      amount  : amountCents,
      currency: 'usd',
      customer: stripeCustomerId,
      payment_method_types: ['customer_balance'],
      payment_method_data : { type: 'customer_balance' },
      payment_method_options: {
        customer_balance: {
          funding_type  : 'bank_transfer',
          bank_transfer : { type: 'us_bank_transfer' },
        },
      },
      application_fee_amount: platformFee,
      transfer_data         : { destination: stripeAccountId },
      confirm : true,
      metadata: { order_id, flow, method, brand_name: brandName ?? '' },
    });

    const instructions =
      (pi as unknown as { next_action?: { display_bank_transfer_instructions?: unknown } })
        ?.next_action?.display_bank_transfer_instructions ?? null;

    await admin.from('buyer_payments').insert({
      order_id,
      stripe_customer_id      : stripeCustomerId,
      stripe_payment_intent_id: pi.id,
      method,
      status                  : 'pending',
      amount_usd              : order.total_usd,
      installment_seq         : 1,
      bank_transfer_instructions: instructions as object,
    });

    await admin.from('buyer_orders').update({ payment_status: 'pending_wire' }).eq('id', order_id);

    return NextResponse.json({ type: 'wire', instructions, payment_intent_id: pi.id });
  }

  // ── ACH via Financial Connections ─────────────────────────────────────────
  if (method === 'ach') {
    const setupFutureUsage = flow !== 'immediate' ? 'off_session' : undefined;

    const pi = await stripe.paymentIntents.create({
      amount  : amountCents,
      currency: 'usd',
      customer: stripeCustomerId,
      payment_method_types: ['us_bank_account'],
      payment_method_options: {
        us_bank_account: {
          financial_connections: { permissions: ['payment_method'] },
        },
      },
      application_fee_amount: platformFee,
      transfer_data         : { destination: stripeAccountId },
      ...(setupFutureUsage ? { setup_future_usage: setupFutureUsage } : {}),
      metadata: { order_id, flow, method, brand_name: brandName ?? '', installment_seq: '1' },
    });

    await admin.from('buyer_payments').insert({
      order_id,
      stripe_customer_id      : stripeCustomerId,
      stripe_payment_intent_id: pi.id,
      method,
      status                  : 'pending',
      amount_usd              : amountCents / 100,
      installment_seq         : 1,
    });

    return NextResponse.json({ type: 'ach', client_secret: pi.client_secret });
  }

  // ── Card (immediate or with setup_future_usage for installments/pay-later) ─
  const setupFutureUsage = flow !== 'immediate' ? 'off_session' : undefined;

  const pi = await stripe.paymentIntents.create({
    amount  : amountCents,
    currency: 'usd',
    customer: stripeCustomerId,
    payment_method_types: ['card'],
    application_fee_amount: platformFee,
    transfer_data         : { destination: stripeAccountId },
    ...(setupFutureUsage ? { setup_future_usage: setupFutureUsage } : {}),
    metadata: { order_id, flow, method, brand_name: brandName ?? '', installment_seq: '1' },
  });

  await admin.from('buyer_payments').insert({
    order_id,
    stripe_customer_id      : stripeCustomerId,
    stripe_payment_intent_id: pi.id,
    method,
    status                  : 'pending',
    amount_usd              : amountCents / 100,
    installment_seq         : 1,
  });

  return NextResponse.json({ type: 'card', client_secret: pi.client_secret });
}
