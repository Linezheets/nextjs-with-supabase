/**
 * Buyer refund logic (P0 #3).
 *
 * Escrow model = separate charges + transfers: the buyer was charged into the
 * PLATFORM Stripe balance, and the brand is paid later via an explicit transfer.
 * So returning money to the buyer requires:
 *   1. (if escrow already released) reverse the brand transfer to claw the
 *      payout back into the platform balance;
 *   2. stripe.refunds.create against each succeeded PaymentIntent — this is the
 *      actual buyer ← platform money-back that was previously never issued;
 *   3. restore inventory and mark the order/payments refunded.
 *
 * Idempotent: per-payment Stripe idempotency keys, a per-payment stripe_refund_id
 * guard, and a terminal escrow_status='refunded' that blocks any re-release.
 */

import stripe from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/server';
import { toCents } from '@/lib/currency';

export type RefundResult = {
  orderId         : string;
  refundedUsd     : number;     // cumulative refunded for the order (decimal USD)
  refundIds       : string[];   // Stripe refund ids created in THIS call
  reversedTransfer: boolean;    // whether a brand transfer was clawed back
  fullyRefunded   : boolean;
  alreadyRefunded?: boolean;
};

type StripeRefundReason = 'duplicate' | 'fraudulent' | 'requested_by_customer';

export async function refundOrder(
  orderId: string,
  opts?: { amountUsd?: number | null; reason?: StripeRefundReason },
): Promise<RefundResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: order } = await admin
    .from('buyer_orders')
    .select('id, total_usd, escrow_status, stripe_transfer_id, status, refund_status')
    .eq('id', orderId)
    .single() as {
      data: {
        id: string; total_usd: number; escrow_status: string | null;
        stripe_transfer_id: string | null; status: string | null; refund_status: string | null;
      } | null;
    };
  if (!order) throw new Error(`Order ${orderId} not found`);

  // Idempotent — fully refunded already.
  if (order.escrow_status === 'refunded' || order.refund_status === 'refunded') {
    return { orderId, refundedUsd: Number(order.total_usd ?? 0), refundIds: [], reversedTransfer: false, fullyRefunded: true, alreadyRefunded: true };
  }

  // 1. Claw back the brand payout first if escrow was already released, so the
  //    buyer refund is funded from the platform balance rather than the
  //    platform's own pocket. Single idempotency key per order = at most one
  //    reversal even if the dispute path and the refund endpoint both run.
  let reversedTransfer = false;
  if (order.escrow_status === 'released' && order.stripe_transfer_id) {
    await stripe.transfers.createReversal(
      order.stripe_transfer_id, {}, { idempotencyKey: `reversal-${orderId}` },
    );
    reversedTransfer = true;
  }

  // 2. Refund each succeeded payment against its PaymentIntent.
  const { data: paymentRows } = await admin
    .from('buyer_payments')
    .select('id, amount_usd, stripe_payment_intent_id, stripe_refund_id, installment_seq')
    .eq('order_id', orderId)
    .eq('status', 'succeeded')
    .order('installment_seq', { ascending: true }) as {
      data: Array<{ id: string; amount_usd: number | null; stripe_payment_intent_id: string | null; stripe_refund_id: string | null; installment_seq: number | null }> | null;
    };

  const succeeded = (paymentRows ?? []).filter(p => p.stripe_payment_intent_id);
  if (succeeded.length === 0 && !reversedTransfer) {
    throw new Error(`No succeeded payments to refund for order ${orderId}`);
  }

  // null remaining = full refund (omit Stripe amount → refunds the whole PI).
  let remainingCents: number | null = opts?.amountUsd != null ? toCents(opts.amountUsd) : null;
  const refundIds: string[] = [];
  const now = new Date().toISOString();

  for (const p of succeeded) {
    if (p.stripe_refund_id) continue;                          // already refunded
    if (remainingCents !== null && remainingCents <= 0) break;

    const payCents  = toCents(Number(p.amount_usd ?? 0));
    const thisCents = remainingCents !== null ? Math.min(payCents, remainingCents) : payCents;

    const refund = await stripe.refunds.create(
      {
        payment_intent: p.stripe_payment_intent_id!,
        ...(remainingCents !== null ? { amount: thisCents } : {}),  // omit ⇒ full PI refund
        ...(opts?.reason ? { reason: opts.reason } : {}),
        metadata: { order_id: orderId, payment_id: p.id },
      },
      { idempotencyKey: `refund-${orderId}-${p.id}` },
    );

    refundIds.push(refund.id);
    const appliedCents = refund.amount ?? thisCents;
    if (remainingCents !== null) remainingCents -= appliedCents;

    await admin
      .from('buyer_payments')
      .update({ stripe_refund_id: refund.id, refunded_amount_usd: appliedCents / 100, updated_at: now })
      .eq('id', p.id);
  }

  // 3. Recompute cumulative refunded from the payment rows (authoritative, and
  //    correct across repeated partial refunds), then mark the order.
  const { data: refRows } = await admin
    .from('buyer_payments')
    .select('refunded_amount_usd')
    .eq('order_id', orderId) as { data: Array<{ refunded_amount_usd: number | null }> | null };
  const refundedUsd = Math.round(((refRows ?? []).reduce((s, r) => s + Number(r.refunded_amount_usd ?? 0), 0)) * 100) / 100;

  const totalCents    = toCents(Number(order.total_usd ?? 0));
  const fullyRefunded = toCents(refundedUsd) + 1 >= totalCents;   // 1-cent tolerance

  await admin
    .from('buyer_orders')
    .update({
      refund_status      : fullyRefunded ? 'refunded' : 'partially_refunded',
      refunded_amount_usd : refundedUsd,
      refunded_at        : now,
      ...(fullyRefunded ? { status: 'refunded', escrow_status: 'refunded' } : {}),
      updated_at         : now,
    })
    .eq('id', orderId);

  // Restore inventory (idempotent — the RPC no-ops if already restored).
  if (fullyRefunded) {
    try {
      const { error: restoreErr } = await admin.rpc('restore_order_stock', { p_order_id: orderId });
      if (restoreErr) console.error('[refund] stock restore failed for', orderId, restoreErr);
    } catch (e) {
      console.error('[refund] stock restore threw for', orderId, e);
    }
  }

  return { orderId, refundedUsd, refundIds, reversedTransfer, fullyRefunded };
}
