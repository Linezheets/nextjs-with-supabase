import { NextRequest, NextResponse } from 'next/server';
import stripe from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email';
import { stripeCode, toCents } from '@/lib/currency';

const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL ?? 'info@mxlla.com';

type DuePayment = {
  id                      : string;
  order_id                : string;
  stripe_customer_id      : string;
  stripe_payment_method_id: string;
  amount_usd              : number;
  amount                  : number | null;
  currency                : string | null;
  installment_seq         : number;
};

type OrderRow = {
  id        : string;
  items     : { brand_name?: string | null }[];
};


// Vercel Cron calls this daily at 08:00 UTC.
// Protected by CRON_SECRET to prevent unauthenticated triggers.
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const today = new Date().toISOString().split('T')[0];

  const { data: due } = await admin
    .from('buyer_payments')
    .select('id, order_id, stripe_customer_id, stripe_payment_method_id, amount_usd, amount, currency, installment_seq')
    .eq('status', 'pending')
    .lte('due_date', today)
    .not('stripe_payment_method_id', 'is', null) as { data: DuePayment[] | null };

  if (!due?.length) return NextResponse.json({ charged: 0 });

  const results: { id: string; status: string; error?: string }[] = [];

  for (const payment of due) {
    try {
      // Resolve brand's Stripe Connect account for this order
      const { data: order } = await admin
        .from('buyer_orders')
        .select('id, items')
        .eq('id', payment.order_id)
        .single() as { data: OrderRow | null };

      const brandName: string | null =
        Array.isArray(order?.items) ? (order!.items[0]?.brand_name ?? null) : null;

      const chargeAmount   = payment.amount ?? payment.amount_usd;
      const chargeCurrency = payment.currency ?? 'USD';
      const amountCents    = toCents(chargeAmount);

      // Escrow: no transfer_data / application_fee — funds held in platform account
      const pi = await stripe.paymentIntents.create({
        amount        : amountCents,
        currency      : stripeCode(chargeCurrency),
        customer      : payment.stripe_customer_id,
        payment_method: payment.stripe_payment_method_id,
        off_session   : true,
        confirm       : true,
        transfer_group: payment.order_id,
        metadata      : {
          order_id       : payment.order_id,
          installment_seq: String(payment.installment_seq),
          brand_name     : brandName ?? '',
          source         : 'cron',
        },
      });

      await admin
        .from('buyer_payments')
        .update({
          status                  : pi.status === 'succeeded' ? 'succeeded' : 'processing',
          stripe_payment_intent_id: pi.id,
          updated_at              : new Date().toISOString(),
        })
        .eq('id', payment.id);

      if (pi.status === 'succeeded') {
        await admin
          .from('buyer_orders')
          .update({ payment_status: 'paid', updated_at: new Date().toISOString() })
          .eq('id', payment.order_id);
      }

      results.push({ id: payment.id, status: pi.status });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[cron] installment charge failed:', payment.id, msg);

      await admin
        .from('buyer_payments')
        .update({
          status                : 'failed',
          payment_attempt_status: msg,
          updated_at            : new Date().toISOString(),
        })
        .eq('id', payment.id);

      await sendEmail({
        to     : NOTIFY_EMAIL,
        subject: `[Linezheets] Installment charge failed — Order ${payment.order_id}`,
        html   : `<p>Instalment #${payment.installment_seq} for order <strong>${payment.order_id}</strong> failed.</p><p>${msg}</p>`,
      }).catch(console.error);

      results.push({ id: payment.id, status: 'failed', error: msg });
    }
  }

  return NextResponse.json({ charged: results.length, results });
}
