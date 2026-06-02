import { NextRequest, NextResponse } from 'next/server';
import stripe from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email';
import type Stripe from 'stripe';

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
      await syncOrderStatus(admin, pi.metadata.order_id, 'paid');

      // If this was a card/ach with future use and installments remain, schedule them
      if (pi.setup_future_usage === 'off_session' && pmId) {
        await scheduleRemainingInstallments(admin, pi, pmId);
      }

      await notifySeller(admin, pi.metadata.order_id, 'paid');
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
      await (admin as any)
        .from('brand_storefronts')
        .update({ subscription_status: 'canceled', updated_at: now })
        .eq('stripe_subscription_id', sub.id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any)
        .from('brand_subscriptions')
        .update({ status: 'canceled', canceled_at: now, updated_at: now })
        .eq('stripe_subscription_id', sub.id);
      break;
    }

    case 'invoice.payment_succeeded': {
      const inv   = event.data.object as Stripe.Invoice;
      const subId = typeof inv.subscription === 'string' ? inv.subscription : inv.subscription?.id;
      if (!subId) break;
      const now = new Date().toISOString();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any)
        .from('brand_storefronts')
        .update({ subscription_status: 'active', updated_at: now })
        .eq('stripe_subscription_id', subId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any)
        .from('brand_subscriptions')
        .update({ status: 'active', updated_at: now })
        .eq('stripe_subscription_id', subId);
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

async function scheduleRemainingInstallments(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin      : any,
  pi         : Stripe.PaymentIntent,
  pmId       : string,
) {
  const orderId  = pi.metadata.order_id;
  const brandName = pi.metadata.brand_name; // set in create-intent
  if (!orderId) return;

  const { data: order } = await admin
    .from('buyer_orders')
    .select('total_usd')
    .eq('id', orderId)
    .single();

  // Look up brand payment terms by brand_name (stored in PI metadata)
  const { data: terms } = brandName
    ? await admin
        .from('brand_payment_terms')
        .select('installment_count, installment_days')
        .eq('brand_name', brandName)
        .maybeSingle()
    : { data: null };

  const count    = terms?.installment_count ?? 2;
  const interval = terms?.installment_days  ?? 30;
  const perInstallment = (order?.total_usd ?? 0) / count;

  // First installment already paid; schedule the rest
  for (let seq = 2; seq <= count; seq++) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + interval * (seq - 1));

    await admin.from('buyer_payments').insert({
      order_id                : orderId,
      stripe_customer_id      : pi.customer,
      stripe_payment_method_id: pmId,
      method                  : pi.metadata.method ?? 'card',
      status                  : 'pending',
      amount_usd              : perInstallment,
      installment_seq         : seq,
      due_date                : dueDate.toISOString().split('T')[0],
    });
  }
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
