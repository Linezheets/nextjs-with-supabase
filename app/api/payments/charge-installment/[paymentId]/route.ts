import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import stripe from '@/lib/stripe';
import { stripeCode, toCents } from '@/lib/currency';

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
    .select('id, order_id, amount_usd, amount, currency, status, installment_seq, stripe_customer_id, stripe_payment_method_id')
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

  const brandName      = Array.isArray(order.items) ? (order.items[0]?.brand_name ?? null) : null;
  const chargeAmount   = payment.amount ?? payment.amount_usd;
  const chargeCurrency = payment.currency ?? 'USD';
  const amountCents    = toCents(parseFloat(chargeAmount));

  try {
    const pi = await stripe.paymentIntents.create({
      amount        : amountCents,
      currency      : stripeCode(chargeCurrency),
      customer      : payment.stripe_customer_id,
      payment_method: paymentMethodId,
      confirm       : true,
      off_session   : true,
      // Escrow: no transfer_data / application_fee — held in platform account
      transfer_group: payment.order_id,
      metadata      : {
        order_id       : payment.order_id,
        installment_seq: String(payment.installment_seq),
        brand_name     : brandName ?? '',
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
