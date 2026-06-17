/**
 * Escrow / fund release logic.
 *
 * Payments are captured into the platform's Stripe account (no transfer_data on
 * the PaymentIntent). When an order is delivered/confirmed, we call releaseEscrow()
 * which creates explicit Stripe transfers to the brand's Connect account — minus
 * the platform commission.
 */

import stripe from '@/lib/stripe';
import type Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/server';
import { resolveCommissionRateByName } from '@/lib/commission';
import { stripeCode, toCents } from '@/lib/currency';

type ReleaseResult = {
  orderId    : string;
  transferred: number;   // amount transferred in minor units (cents)
  currency   : string;
  transferId : string;   // Stripe transfer ID
  fee        : number;   // platform commission kept (minor units)
};

/**
 * Release escrowed funds for an order to the brand's Stripe Connect account.
 * Safe to call multiple times — idempotent if already released.
 */
export async function releaseEscrow(orderId: string): Promise<ReleaseResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  // 1. Load order
  const { data: order } = await admin
    .from('buyer_orders')
    .select('id, total_usd, currency, escrow_status, stripe_transfer_id, brand_name, items')
    .eq('id', orderId)
    .single() as {
      data: {
        id              : string;
        total_usd       : number;
        currency        : string | null;
        escrow_status   : string | null;
        stripe_transfer_id: string | null;
        brand_name      : string | null;
        items           : { brand_name?: string | null }[];
      } | null;
    };

  if (!order) throw new Error(`Order ${orderId} not found`);

  // Never release a refunded order to the brand. (The atomic claim below also
  // blocks this — it only matches held/releasing — but fail fast and clearly.)
  if (order.escrow_status === 'refunded') {
    throw new Error(`Cannot release escrow for ${orderId}: order has been refunded`);
  }

  // Idempotent — already released
  if (order.escrow_status === 'released' && order.stripe_transfer_id) {
    return {
      orderId,
      transferred: 0,
      currency   : order.currency ?? 'USD',
      transferId : order.stripe_transfer_id,
      fee        : 0,
    };
  }

  // Never release funds while a dispute is open — funds must stay in escrow so a
  // refund can be issued from the platform balance rather than clawed back.
  const { data: openDisputes } = await admin
    .from('dispute_requests')
    .select('id')
    .eq('order_id', orderId)
    .not('status', 'in', '("resolved_refund","resolved_credit","resolved_no_action","closed")');
  if (openDisputes && openDisputes.length) {
    throw new Error(`Cannot release escrow for ${orderId}: an open dispute exists`);
  }

  const orderCurrency = order.currency ?? 'USD';
  // Authoritative single brand for the order (legacy orders fall back to items[0]).
  const brandName     = order.brand_name
    ?? (Array.isArray(order.items) ? (order.items[0]?.brand_name ?? null) : null);

  if (!brandName) throw new Error(`Order ${orderId} has no brand_name`);

  // 2. Load brand's Stripe Connect account
  const { data: sf } = await admin
    .from('brand_storefronts')
    .select('stripe_account_id, stripe_account_status')
    .eq('brand_name', brandName)
    .maybeSingle() as {
      data: { stripe_account_id: string | null; stripe_account_status: string | null } | null;
    };

  if (!sf?.stripe_account_id || sf.stripe_account_status !== 'active') {
    throw new Error(`Brand "${brandName}" does not have an active Stripe Connect account`);
  }

  // 3. Sum all succeeded payments for this order
  const { data: payments } = await admin
    .from('buyer_payments')
    .select('id, amount, amount_usd, currency, stripe_transfer_id')
    .eq('order_id', orderId)
    .eq('status', 'succeeded') as {
      data: {
        id              : string;
        amount          : number | null;
        amount_usd      : number;
        currency        : string | null;
        stripe_transfer_id: string | null;
      }[] | null;
    };

  if (!payments?.length) throw new Error(`No succeeded payments found for order ${orderId}`);

  // Release is based on funds ACTUALLY CAPTURED, never on the order total — so
  // the platform can never transfer more than it holds. Refuse to release until
  // the order is fully collected (1-cent tolerance for rounding).
  const collectedUsd   = payments.reduce((s, p) => s + Number(p.amount_usd ?? p.amount ?? 0), 0);
  const collectedCents = toCents(collectedUsd);
  const totalCents     = toCents(order.total_usd);
  if (collectedCents + 1 < totalCents) {
    throw new Error(
      `Cannot release escrow for ${orderId}: only ${collectedUsd.toFixed(2)} of ${Number(order.total_usd).toFixed(2)} collected`,
    );
  }
  const grossCents = collectedCents;

  // 4. Calculate commission and payout
  const commissionRate = await resolveCommissionRateByName(brandName);
  const feeCents       = Math.round(grossCents * commissionRate);
  const payoutCents    = grossCents - feeCents;

  // 4b. Atomically claim the release. The conditional UPDATE only succeeds when
  // the order is 'held'/'releasing', serialising the two release paths (the
  // status-PATCH auto-release and the manual POST /payments/release). If it has
  // already been released, return idempotently instead of transferring again.
  const { data: claimed } = await admin
    .from('buyer_orders')
    .update({ escrow_status: 'releasing', updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .in('escrow_status', ['held', 'releasing'])
    .select('id') as { data: { id: string }[] | null };

  if (!claimed || claimed.length === 0) {
    const { data: fresh } = await admin
      .from('buyer_orders')
      .select('escrow_status, stripe_transfer_id, currency')
      .eq('id', orderId)
      .single() as { data: { escrow_status: string | null; stripe_transfer_id: string | null; currency: string | null } | null };
    if (fresh?.escrow_status === 'released' && fresh.stripe_transfer_id) {
      return { orderId, transferred: 0, currency: fresh.currency ?? 'USD', transferId: fresh.stripe_transfer_id, fee: 0 };
    }
    throw new Error(`Order ${orderId} escrow is not in a releasable state (${fresh?.escrow_status ?? 'unknown'})`);
  }

  // 5. Create Stripe transfer (separate charges + transfers model).
  // idempotencyKey is the hard guard against a double payout: even if two
  // callers reach here, Stripe returns the SAME transfer for both. On failure
  // we roll the claim back to 'held' so the release can be retried.
  let transfer: Stripe.Transfer;
  try {
    transfer = await stripe.transfers.create({
      amount         : payoutCents,
      currency       : stripeCode(orderCurrency),
      destination    : sf.stripe_account_id,
      transfer_group : orderId,
      metadata       : {
        order_id       : orderId,
        brand_name     : brandName,
        gross_cents    : String(grossCents),
        fee_cents      : String(feeCents),
        commission_rate: String(commissionRate),
      },
    }, { idempotencyKey: `release-${orderId}` });
  } catch (err) {
    await admin
      .from('buyer_orders')
      .update({ escrow_status: 'held', updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .eq('escrow_status', 'releasing');
    throw err;
  }

  const now = new Date().toISOString();

  // 6. Mark order as released
  await admin
    .from('buyer_orders')
    .update({
      escrow_status      : 'released',
      escrow_released_at : now,
      stripe_transfer_id : transfer.id,
      updated_at         : now,
    })
    .eq('id', orderId);

  // 7. Mark each payment row with the transfer ID
  const paymentIds = payments.map(p => p.id);
  await admin
    .from('buyer_payments')
    .update({ stripe_transfer_id: transfer.id, updated_at: now })
    .in('id', paymentIds);

  return {
    orderId,
    transferred: payoutCents,
    currency   : orderCurrency,
    transferId : transfer.id,
    fee        : feeCents,
  };
}

/**
 * Should this order be auto-released on status change?
 * Release when status becomes 'delivered' and payment is fully captured.
 */
export function shouldAutoRelease(
  newStatus    : string,
  paymentStatus: string,
  escrowStatus : string,
): boolean {
  return (
    newStatus     === 'delivered' &&
    paymentStatus === 'paid' &&
    escrowStatus  !== 'released'
  );
}
