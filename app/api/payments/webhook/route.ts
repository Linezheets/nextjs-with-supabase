import { NextRequest, NextResponse } from 'next/server';
import stripe from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/server';
import { sendEmail, orderStatusUpdateHtml } from '@/lib/email';
import { reconcileOrderPaymentStatus } from '@/lib/payments-status';
import { resolveBuyerEmail } from '@/lib/orders/buyer-email';
import type Stripe from 'stripe';

// Grant or revoke brand role in Supabase auth metadata
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function setBrandRole(admin: any, userId: string, active: boolean) {
  try {
    await admin.auth.admin.updateUserById(userId, {
      app_metadata: { role: active ? 'brand' : null },
    });
  } catch (err) {
    console.error('[webhook] setBrandRole failed:', err);
  }
}

// Next.js App Router reads raw body via req.text() — no config needed

const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL ?? 'info@mxlla.com';

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[webhook] STRIPE_WEBHOOK_SECRET not set');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  }

  const rawBody = await req.text();
  const sig     = req.headers.get('stripe-signature') ?? '';

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('[webhook] signature failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const admin = createAdminClient();

  // ── Idempotency: process each Stripe event at most once ───────────────────
  // Stripe retries deliveries; without this guard a replayed event would
  // re-schedule installments, double-charge, re-grant roles, etc.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: dedupeErr } = await (admin as any)
    .from('stripe_webhook_events')
    .insert({ event_id: event.id, type: event.type });
  if (dedupeErr) {
    // Unique violation (23505) = already processed → ack and stop.
    if (dedupeErr.code === '23505') {
      return NextResponse.json({ received: true, duplicate: true });
    }
    // Any other failure: log and continue (don't drop a real event over a
    // bookkeeping error), but most handlers below are themselves idempotent.
    console.error('[webhook] dedupe insert failed:', dedupeErr);
  }

  switch (event.type) {
    case 'payment_intent.processing': {
      const pi = event.data.object as Stripe.PaymentIntent;
      await syncPaymentStatus(admin, pi.id, 'processing');
      await syncOrderStatus(admin, pi.metadata.order_id, 'payment_processing');
      break;
    }

    case 'payment_intent.succeeded': {
      const pi = event.data.object as Stripe.PaymentIntent;

      // Save payment method id for future off-session charges (installments)
      const pmId = typeof pi.payment_method === 'string'
        ? pi.payment_method
        : pi.payment_method?.id;

      await syncPaymentStatus(admin, pi.id, 'succeeded', pmId);
      // Recompute payment_status from the ledger: only mark the ORDER 'paid'
      // when the sum of succeeded payments covers the total and nothing is still
      // pending/processing. A single installment must NOT flip the order to paid
      // (that previously over-released escrow). Multi-installment scheduling is
      // owned by /api/payments/installment-plan — the webhook no longer schedules
      // installments (the old path charged the full total on seq 1 AND scheduled
      // more, double-collecting from the buyer).
      if (pi.metadata.order_id) {
        await reconcileOrderPaymentStatus(admin, pi.metadata.order_id);
      }

      await notifySeller(admin, pi.metadata.order_id, 'paid');
      // Buyer payment receipt — previously only the platform/admin was notified.
      await notifyBuyerReceipt(admin, pi.metadata.order_id, pi.amount_received ?? pi.amount, pi.currency);
      break;
    }

    case 'payment_intent.payment_failed': {
      const pi = event.data.object as Stripe.PaymentIntent;
      const reason = pi.last_payment_error?.message ?? 'unknown';
      await syncPaymentStatus(admin, pi.id, 'failed', undefined, reason);
      await syncOrderStatus(admin, pi.metadata.order_id, 'payment_failed');
      await notifySeller(admin, pi.metadata.order_id, 'payment_failed', reason);
      break;
    }

    // ── Stripe Connect: sync account status when brand completes onboarding ───
    case 'account.updated': {
      const account = event.data.object as Stripe.Account;
      const status  = account.charges_enabled ? 'active' : 'pending';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any)
        .from('brand_storefronts')
        .update({ stripe_account_status: status })
        .eq('stripe_account_id', account.id);
      break;
    }

    // ── Subscription lifecycle ────────────────────────────────────────────────
    case 'customer.subscription.updated': {
      const sub     = event.data.object as Stripe.Subscription;
      const now     = new Date().toISOString();
      const tier    = (sub.metadata?.tier ?? 'starter') as string;
      const updates = {
        subscription_status    : sub.status,
        subscription_tier      : tier,
        stripe_subscription_id : sub.id,
        updated_at             : now,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any)
        .from('brand_storefronts')
        .update(updates)
        .eq('stripe_subscription_id', sub.id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any)
        .from('brand_subscriptions')
        .update({
          status                : sub.status,
          tier,
          cancel_at_period_end  : sub.cancel_at_period_end,
          current_period_start  : new Date(sub.current_period_start * 1000).toISOString(),
          current_period_end    : new Date(sub.current_period_end   * 1000).toISOString(),
          updated_at            : now,
        })
        .eq('stripe_subscription_id', sub.id);
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const now = new Date().toISOString();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = admin as any;
      await db.from('brand_storefronts')
        .update({ subscription_status: 'canceled', updated_at: now })
        .eq('stripe_subscription_id', sub.id);
      await db.from('brand_subscriptions')
        .update({ status: 'canceled', canceled_at: now, updated_at: now })
        .eq('stripe_subscription_id', sub.id);
      // Revoke brand role when subscription ends
      const { data: sf } = await db.from('brand_storefronts')
        .select('user_id').eq('stripe_subscription_id', sub.id).maybeSingle();
      if (sf?.user_id) await setBrandRole(admin, sf.user_id, false);
      break;
    }

    case 'invoice.payment_succeeded': {
      const inv   = event.data.object as Stripe.Invoice;
      const subId = typeof inv.subscription === 'string' ? inv.subscription : inv.subscription?.id;
      if (!subId) break;
      const now = new Date().toISOString();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = admin as any;
      await db.from('brand_storefronts')
        .update({ subscription_status: 'active', updated_at: now })
        .eq('stripe_subscription_id', subId);
      await db.from('brand_subscriptions')
        .update({ status: 'active', updated_at: now })
        .eq('stripe_subscription_id', subId);
      // Grant brand role in Supabase auth so middleware recognises the user as brand
      const { data: sf } = await db.from('brand_storefronts')
        .select('user_id').eq('stripe_subscription_id', subId).maybeSingle();
      if (sf?.user_id) await setBrandRole(admin, sf.user_id, true);
      break;
    }

    case 'invoice.payment_failed': {
      const inv   = event.data.object as Stripe.Invoice;
      const subId = typeof inv.subscription === 'string' ? inv.subscription : inv.subscription?.id;
      if (!subId) break;
      const now = new Date().toISOString();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any)
        .from('brand_storefronts')
        .update({ subscription_status: 'past_due', updated_at: now })
        .eq('stripe_subscription_id', subId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any)
        .from('brand_subscriptions')
        .update({ status: 'past_due', updated_at: now })
        .eq('stripe_subscription_id', subId);
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}

async function syncPaymentStatus(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  piId : string,
  status: string,
  pmId?: string,
  failReason?: string,
) {
  const patch: Record<string, unknown> = {
    status,
    payment_attempt_status: status,
    updated_at            : new Date().toISOString(),
  };
  if (pmId)       patch.stripe_payment_method_id = pmId;
  if (failReason) patch.payment_attempt_status   = failReason;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from('buyer_payments')
    .update(patch)
    .eq('stripe_payment_intent_id', piId);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncOrderStatus(admin: any, orderId: string, paymentStatus: string) {
  if (!orderId) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from('buyer_orders')
    .update({ payment_status: paymentStatus, updated_at: new Date().toISOString() })
    .eq('id', orderId);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function notifySeller(admin: any, orderId: string, event: string, detail?: string) {
  if (!orderId) return;

  const { data: order } = await admin
    .from('buyer_orders')
    .select('id, buyer_name, total_usd, items')
    .eq('id', orderId)
    .single();

  if (!order) return;

  const subject =
    event === 'paid'
      ? `[Linezheets] Payment received — Order ${orderId}`
      : `[Linezheets] Payment ${event} — Order ${orderId}`;

  const html = `
    <p>Order <strong>${orderId}</strong> — <strong>${order.buyer_name}</strong></p>
    <p>Amount: <strong>$${order.total_usd?.toLocaleString()}</strong></p>
    <p>Status: <strong>${event}</strong>${detail ? ` — ${detail}` : ''}</p>
  `;

  await sendEmail({ to: NOTIFY_EMAIL, subject, html }).catch(console.error);
}

// Buyer-facing payment receipt on a successful charge.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function notifyBuyerReceipt(admin: any, orderId: string, amountMinor: number, currency: string) {
  if (!orderId) return;
  const { data: order } = await admin
    .from('buyer_orders')
    .select('id, buyer_id, buyer_name')
    .eq('id', orderId)
    .single();
  if (!order) return;

  const buyerEmail = await resolveBuyerEmail(admin, order.buyer_name, order.buyer_id);
  if (!buyerEmail) return;

  const amount = (Number(amountMinor ?? 0) / 100).toLocaleString('en-US', {
    style: 'currency', currency: (currency || 'usd').toUpperCase(),
  });
  const buyerName = order.buyer_name && !String(order.buyer_name).includes('@') ? order.buyer_name : 'there';

  await sendEmail({
    to     : buyerEmail,
    subject: `Payment received — order ${orderId}`,
    html   : orderStatusUpdateHtml({
      buyer_name  : buyerName,
      order_id    : orderId,
      status      : 'payment received',
      message     : `We've received your payment of ${amount}. Thank you — order ${orderId} is confirmed.`,
      platform_url: process.env.NEXT_PUBLIC_SITE_URL,
    }),
  }).catch(console.error);
}
