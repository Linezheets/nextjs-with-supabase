import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import stripe from '@/lib/stripe';

const PLATFORM_FEE_RATE = parseFloat(process.env.PLATFORM_COMMISSION_RATE ?? '3') / 100;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { paymentId } = await params;
  const body = await req.json().catch(() => ({})) as { payment_method_id?: string };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  // Verify the payment belongs to the authenticated user's order
  const { data: payment } = await admin
    .from('buyer_payments')
    .select('id, order_id, amount_usd, status, installment_seq, stripe_customer_id, stripe_payment_method_id')
    .eq('id', paymentId)
    .maybeSingle();

  if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
  if (payment.status === 'succeeded') return NextResponse.json({ error: 'Already paid' }, { status: 400 });

  // Confirm order belongs to this user
  const { data: order } = await admin
    .from('buyer_orders')
    .select('id, items')
    .eq('id', payment.order_id)
    .eq('buyer_id', user.id)
    .maybeSingle();

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  const paymentMethodId = body.payment_method_id ?? payment.stripe_payment_method_id;
  if (!paymentMethodId) return NextResponse.json({ error: 'No payment method on file' }, { status: 400 });

  // Resolve brand's Stripe Connect account
  const brandName = Array.isArray(order.items) ? (order.items[0]?.brand_name ?? null) : null;
  let stripeAccountId: string | null = null;
  if (brandName) {
    const { data: sf } = await admin
      .from('brand_storefronts')
      .select('stripe_account_id, stripe_account_status')
      .eq('brand_name', brandName)
      .maybeSingle();
    stripeAccountId = sf?.stripe_account_status === 'active' ? (sf.stripe_account_id ?? null) : null;
  }

  if (!stripeAccountId) {
    return NextResponse.json({ error: 'Brand has no active Stripe Connect account' }, { status: 400 });
  }

  const amountCents = Math.round(parseFloat(payment.amount_usd) * 100);
  const platformFee = Math.round(amountCents * PLATFORM_FEE_RATE);

  try {
    const pi = await stripe.paymentIntents.create({
      amount                : amountCents,
      currency              : 'usd',
      customer              : payment.stripe_customer_id,
      payment_method        : paymentMethodId,
      confirm               : true,
      off_session           : true,
      application_fee_amount: platformFee,
      transfer_data         : { destination: stripeAccountId },
      metadata              : {
        order_id       : payment.order_id,
        installment_seq: String(payment.installment_seq),
      },
    });

    const now = new Date().toISOString();
    await admin.from('buyer_payments').update({
      status                  : pi.status === 'succeeded' ? 'succeeded' : 'processing',
      stripe_payment_intent_id: pi.id,
      updated_at              : now,
    }).eq('id', paymentId);

    if (pi.status === 'succeeded') {
      await admin.from('buyer_orders').update({
        payment_status: 'paid',
        updated_at    : now,
      }).eq('id', payment.order_id);
    }

    return NextResponse.json({
      success              : true,
      payment_intent_status: pi.status,
      amount               : amountCents / 100,
    });
  } catch (err) {
    const msg = (err as Error).message;
    await admin.from('buyer_payments').update({
      status                : 'failed',
      payment_attempt_status: msg,
      updated_at            : new Date().toISOString(),
    }).eq('id', paymentId);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
