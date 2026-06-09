import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import stripe from '@/lib/stripe';
import { resolveCommissionRateByName } from '@/lib/commission';
import { stripeCode, toCents } from '@/lib/currency';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  // Rate limit: max 10 payment intent creations per user per 10 minutes
  const ip = getClientIp(req);
  const rl = checkRateLimit(`pi:${ip}`, 10, 10 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, {
      status : 429,
      headers: { 'Retry-After': String(Math.ceil(rl.resetMs / 1000)) },
    });
  }

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
    .select('id, total_usd, currency, stripe_customer_id, brand_name, items')
    .eq('id', order_id)
    .eq('buyer_id', user.id)
    .single() as { data: { id: string; total_usd: number; currency: string | null; stripe_customer_id: string | null; brand_name: string | null; items: { brand_name?: string | null }[] } | null };

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  // Authoritative single brand for metadata / escrow release lookup.
  const brandName: string | null = order.brand_name
    ?? (Array.isArray(order.items) ? (order.items[0]?.brand_name ?? null) : null);

  // ── Idempotency: never start a second charge for the first installment ────
  // A double-submitted checkout (wire auto-confirms!) would otherwise create a
  // duplicate PaymentIntent and a duplicate buyer_payments row.
  const { data: existingRows } = await admin
    .from('buyer_payments')
    .select('id, method, status, stripe_payment_intent_id, bank_transfer_instructions')
    .eq('order_id', order_id)
    .eq('installment_seq', 1)
    .in('status', ['pending', 'processing', 'succeeded'])
    .order('created_at', { ascending: false })
    .limit(1);
  const existing = existingRows?.[0] as
    | { id: string; method: string; status: string; stripe_payment_intent_id: string | null; bank_transfer_instructions: unknown }
    | undefined;

  if (existing) {
    const settled = existing.status === 'succeeded' || existing.status === 'processing';
    // Reuse the existing attempt when it's the same method, or when a charge is
    // already settled/in-flight (never double-charge regardless of method).
    if (settled || existing.method === method) {
      if (existing.status === 'succeeded') {
        return NextResponse.json({ error: 'Order already paid' }, { status: 409 });
      }
      if (existing.method === 'wire') {
        return NextResponse.json({ type: 'wire', instructions: existing.bank_transfer_instructions ?? null, payment_intent_id: existing.stripe_payment_intent_id, reused: true });
      }
      if (existing.stripe_payment_intent_id) {
        try {
          const reused = await stripe.paymentIntents.retrieve(existing.stripe_payment_intent_id);
          return NextResponse.json({ type: existing.method, client_secret: reused.client_secret, reused: true });
        } catch { /* PI gone — fall through and create a fresh one below */ }
      }
    } else {
      // Buyer switched method while the old attempt is still pending — cancel it.
      try { if (existing.stripe_payment_intent_id) await stripe.paymentIntents.cancel(existing.stripe_payment_intent_id); } catch { /* already gone */ }
      await admin.from('buyer_payments').update({ status: 'canceled', updated_at: new Date().toISOString() }).eq('id', existing.id);
    }
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

  const orderCurrency = order.currency ?? 'USD';
  const amountCents   = toCents(order.total_usd ?? 0);
  // Commission is deducted at escrow-release time (separate charges+transfers model).
  // No application_fee_amount or transfer_data on the PaymentIntent — funds held in
  // the platform account until the order is fulfilled and releaseEscrow() is called.
  void resolveCommissionRateByName; // imported for use at release; not used here

  const stripeCurrency = stripeCode(orderCurrency);
  // Wire only supports USD via us_bank_transfer; EUR/GBP orders use card/ACH
  const wireTransferType = orderCurrency === 'GBP' ? 'gb_bank_transfer'
    : orderCurrency === 'EUR' ? 'eu_bank_transfer'
    : 'us_bank_transfer';

  // ── Wire / SEPA via Stripe Customer Balance bank transfer ─────────────────
  if (method === 'wire') {
    const pi = await stripe.paymentIntents.create({
      amount  : amountCents,
      currency: stripeCurrency,
      customer: stripeCustomerId,
      payment_method_types: ['customer_balance'],
      payment_method_data : { type: 'customer_balance' },
      payment_method_options: {
        customer_balance: {
          funding_type  : 'bank_transfer',
          bank_transfer : { type: wireTransferType as 'us_bank_transfer' },
        },
      },
      // Escrow: funds held in platform account — no transfer_data / no application_fee.
      // Transfer is created explicitly via /api/payments/release/[orderId] on delivery.
      transfer_group: order_id,
      confirm : true,
      metadata: { order_id, flow, method, brand_name: brandName ?? '', currency: orderCurrency },
    }, { idempotencyKey: `pi-${order_id}-seq1-wire` });

    const instructions =
      (pi as unknown as { next_action?: { display_bank_transfer_instructions?: unknown } })
        ?.next_action?.display_bank_transfer_instructions ?? null;

    await admin.from('buyer_payments').insert({
      order_id,
      stripe_customer_id      : stripeCustomerId,
      stripe_payment_intent_id: pi.id,
      transfer_group          : order_id,
      method,
      status                  : 'pending',
      amount_usd              : order.total_usd,
      amount                  : order.total_usd,
      currency                : orderCurrency,
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
      currency: stripeCurrency,
      customer: stripeCustomerId,
      payment_method_types: ['us_bank_account'],
      payment_method_options: {
        us_bank_account: {
          financial_connections: { permissions: ['payment_method'] },
        },
      },
      transfer_group: order_id,
      ...(setupFutureUsage ? { setup_future_usage: setupFutureUsage } : {}),
      metadata: { order_id, flow, method, brand_name: brandName ?? '', installment_seq: '1', currency: orderCurrency },
    }, { idempotencyKey: `pi-${order_id}-seq1-ach` });

    await admin.from('buyer_payments').insert({
      order_id,
      stripe_customer_id      : stripeCustomerId,
      stripe_payment_intent_id: pi.id,
      transfer_group          : order_id,
      method,
      status                  : 'pending',
      amount_usd              : amountCents / 100,
      amount                  : amountCents / 100,
      currency                : orderCurrency,
      installment_seq         : 1,
    });

    return NextResponse.json({ type: 'ach', client_secret: pi.client_secret });
  }

  // ── Card (immediate or with setup_future_usage for installments/pay-later) ─
  const setupFutureUsage = flow !== 'immediate' ? 'off_session' : undefined;

  const pi = await stripe.paymentIntents.create({
    amount  : amountCents,
    currency: stripeCurrency,
    customer: stripeCustomerId,
    payment_method_types: ['card'],
    transfer_group: order_id,
    ...(setupFutureUsage ? { setup_future_usage: setupFutureUsage } : {}),
    metadata: { order_id, flow, method, brand_name: brandName ?? '', installment_seq: '1', currency: orderCurrency },
  }, { idempotencyKey: `pi-${order_id}-seq1-card` });

  await admin.from('buyer_payments').insert({
    order_id,
    stripe_customer_id      : stripeCustomerId,
    stripe_payment_intent_id: pi.id,
    transfer_group          : order_id,
    method,
    status                  : 'pending',
    amount_usd              : amountCents / 100,
    amount                  : amountCents / 100,
    currency                : orderCurrency,
    installment_seq         : 1,
  });

  return NextResponse.json({ type: 'card', client_secret: pi.client_secret });
}
