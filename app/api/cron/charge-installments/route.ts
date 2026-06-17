import { NextRequest, NextResponse } from 'next/server';
import stripe from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email';
import { stripeCode, toCents } from '@/lib/currency';
import { reconcileOrderPaymentStatus } from '@/lib/payments-status';

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
  brand_name: string | null;
  items     : { brand_name?: string | null }[];
};


// Vercel Cron calls this daily at 08:00 UTC.
// Protected by CRON_SECRET to prevent unauthenticated triggers.
export async function GET(req: NextRequest) {
  // Fail closed: if CRON_SECRET is unset, refuse rather than accept the literal
  // "Bearer undefined" — this endpoint charges customer cards.
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Cron not configured' }, { status: 503 });
  }
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const today = new Date().toISOString().split('T')[0];

  // Housekeeping: fail linesheet import jobs stuck 'processing' (serverless freeze
  // / timeout leaves them hanging forever). Folded in here to avoid a 3rd cron slot;
  // /api/cron/sweep-linesheet-imports can run more frequently on plans that allow it.
  try {
    await admin
      .from('linesheet_imports')
      .update({ status: 'failed', errors: JSON.stringify([{ message: 'Import timed out.' }]), completed_at: new Date().toISOString() })
      .eq('status', 'processing')
      .lt('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());
  } catch (e) { console.error('[cron] linesheet sweep failed', e); }

  const { data: due } = await admin
    .from('buyer_payments')
    .select('id, order_id, stripe_customer_id, stripe_payment_method_id, amount_usd, amount, currency, installment_seq')
    .eq('status', 'pending')
    .lte('due_date', today)
    .not('stripe_payment_method_id', 'is', null) as { data: DuePayment[] | null };

  if (!due?.length) return NextResponse.json({ charged: 0 });

  const results: { id: string; status: string; error?: string }[] = [];

  for (const payment of due) {
    // ── Atomically claim this row (pending → processing) before charging ────
    // Closes the read-then-charge window: a retried or overlapping cron run
    // finds the row no longer 'pending' and skips it, so it can never charge
    // the same installment twice.
    const { data: claimed, error: claimErr } = await admin
      .from('buyer_payments')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', payment.id)
      .eq('status', 'pending')
      .select('id') as { data: { id: string }[] | null; error: { message: string } | null };

    if (claimErr) {
      console.error('[cron] claim failed:', payment.id, claimErr.message);
      continue;
    }
    if (!claimed || claimed.length === 0) {
      // Already claimed/charged by another run — skip without charging.
      continue;
    }

    try {
      // Resolve brand's Stripe Connect account for this order
      const { data: order } = await admin
        .from('buyer_orders')
        .select('id, brand_name, items')
        .eq('id', payment.order_id)
        .single() as { data: OrderRow | null };

      const brandName: string | null =
        order?.brand_name ?? (Array.isArray(order?.items) ? (order!.items[0]?.brand_name ?? null) : null);

      const chargeAmount   = payment.amount ?? payment.amount_usd;
      const chargeCurrency = payment.currency ?? 'USD';
      const amountCents    = toCents(chargeAmount);

      // Escrow: no transfer_data / application_fee — funds held in platform account.
      // idempotencyKey makes the charge safe to retry: Stripe returns the same
      // PaymentIntent instead of creating a second charge for this installment row.
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
      }, { idempotencyKey: `installment-${payment.id}` });

      await admin
        .from('buyer_payments')
        .update({
          status                  : pi.status === 'succeeded' ? 'succeeded' : 'processing',
          stripe_payment_intent_id: pi.id,
          updated_at              : new Date().toISOString(),
        })
        .eq('id', payment.id);

      if (pi.status === 'succeeded') {
        // Only marks the order 'paid' when ALL installments are collected.
        await reconcileOrderPaymentStatus(admin, payment.order_id);
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
