import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import stripe from '@/lib/stripe';
import { addDays, addMonths, format } from 'date-fns';
import { stripeCode, toCents } from '@/lib/currency';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

type PlanDef = { count: number; schedule: number[]; labels: string[] };

const PLANS: Record<string, PlanDef> = {
  deposit_balance: { count: 2,  schedule: [0.3, 0.7],           labels: ['30% Deposit', '70% Balance on shipment'] },
  '3month'       : { count: 3,  schedule: [1/3, 1/3, 1/3],      labels: ['Payment 1 of 3', 'Payment 2 of 3', 'Payment 3 of 3'] },
  '6month'       : { count: 6,  schedule: Array(6).fill(1/6),   labels: Array.from({ length: 6  }, (_, i) => `Payment ${i + 1} of 6`)  },
  '12month'      : { count: 12, schedule: Array(12).fill(1/12), labels: Array.from({ length: 12 }, (_, i) => `Payment ${i + 1} of 12`) },
  net30          : { count: 1,  schedule: [1],                  labels: ['Net 30 Full Payment'] },
};

function dueDate(planType: string, idx: number): string {
  if (planType === 'net30')          return format(addDays(new Date(), 30), 'yyyy-MM-dd');
  if (planType === 'deposit_balance') return format(idx === 0 ? new Date() : addDays(new Date(), 45), 'yyyy-MM-dd');
  return format(addMonths(new Date(), idx), 'yyyy-MM-dd');
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`installment:${ip}`, 10, 10 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, {
      status : 429,
      headers: { 'Retry-After': String(Math.ceil(rl.resetMs / 1000)) },
    });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { order_id, plan_type, payment_method_id } = await req.json() as {
    order_id         : string;
    plan_type        : string;
    payment_method_id?: string;
  };

  if (!order_id || !plan_type) {
    return NextResponse.json({ error: 'order_id and plan_type required' }, { status: 400 });
  }

  const plan = PLANS[plan_type];
  if (!plan) {
    return NextResponse.json(
      { error: `Invalid plan_type. Choose: ${Object.keys(PLANS).join(', ')}` },
      { status: 400 },
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: order } = await admin
    .from('buyer_orders')
    .select('id, total_usd, currency, stripe_customer_id, brand_name, items, payment_status')
    .eq('id', order_id)
    .eq('buyer_id', user.id)
    .maybeSingle();

  if (!order)                          return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (order.payment_status === 'paid') return NextResponse.json({ error: 'Order already paid' }, { status: 400 });

  // Idempotency: don't create a second schedule if one already exists (a
  // double-submit would otherwise let the cron charge two parallel plans).
  const { data: existingPlan } = await admin
    .from('buyer_payments')
    .select('id')
    .eq('order_id', order_id)
    .in('status', ['pending', 'processing', 'succeeded'])
    .limit(1);
  if (existingPlan && existingPlan.length > 0) {
    return NextResponse.json({ error: 'A payment plan already exists for this order' }, { status: 409 });
  }

  const total         = parseFloat(order.total_usd);
  const orderCurrency = (order.currency ?? 'USD') as string;
  const brandName     = order.brand_name ?? (Array.isArray(order.items) ? (order.items[0]?.brand_name ?? null) : null);

  // Escrow model: no need to look up brand Stripe account at payment time.
  // Funds are held in the platform account; released via /api/payments/release/[orderId] on delivery.

  // Create or reuse Stripe customer
  let customerId: string = order.stripe_customer_id ?? '';
  if (!customerId) {
    const customer = await stripe.customers.create({
      email   : user.email ?? undefined,
      metadata: { supabase_user_id: user.id, order_id },
    });
    customerId = customer.id;
    await admin.from('buyer_orders').update({ stripe_customer_id: customerId }).eq('id', order_id);
  }

  if (payment_method_id) {
    await stripe.paymentMethods.attach(payment_method_id, { customer: customerId });
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: payment_method_id },
    });
  }

  // Build installment rows — distribute amounts and fix rounding on the last installment
  // so all installments always sum exactly to the order total.
  let allocated = 0;
  const installments = plan.schedule.map((pct, i) => {
    const isLast = i === plan.schedule.length - 1;
    const amount = isLast
      ? Math.round((total - allocated) * 100) / 100
      : Math.round(total * pct * 100) / 100;
    allocated += amount;
    return {
      order_id                : order_id,
      stripe_customer_id      : customerId,
      stripe_payment_method_id: payment_method_id ?? null,
      transfer_group          : order_id,
      method                  : 'card',
      status                  : 'pending',
      amount_usd              : amount,
      amount                  : amount,
      currency                : orderCurrency,
      installment_seq         : i + 1,
      due_date                : dueDate(plan_type, i),
    };
  });

  const { data: inserted, error: insErr } = await admin
    .from('buyer_payments')
    .insert(installments)
    .select();

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  await admin.from('buyer_orders').update({
    payment_status  : 'installments_scheduled',
    payment_due_date: installments[0].due_date,
    updated_at      : new Date().toISOString(),
  }).eq('id', order_id);

  // Charge first installment immediately if deposit or 3-month and PM provided
  let firstPaymentResult = null;
  if ((plan_type === 'deposit_balance' || plan_type === '3month') && payment_method_id) {
    const firstAmt = toCents(total * plan.schedule[0]);
    try {
      const pi = await stripe.paymentIntents.create({
        amount        : firstAmt,
        currency      : stripeCode(orderCurrency),
        customer      : customerId,
        payment_method: payment_method_id,
        confirm       : true,
        off_session   : false,
        // Escrow: no transfer_data / application_fee — funds held in platform account
        transfer_group: order_id,
        metadata      : { order_id, installment_seq: '1', plan_type, brand_name: brandName ?? '' },
        description   : `${order_id} — Installment 1/${plan.count} (${plan.labels[0]})`,
      }, { idempotencyKey: `installment-${(inserted as { id: string }[])[0].id}` });

      await admin.from('buyer_payments').update({
        status                  : pi.status === 'succeeded' ? 'succeeded' : 'processing',
        stripe_payment_intent_id: pi.id,
        updated_at              : new Date().toISOString(),
      }).eq('id', (inserted as { id: string }[])[0].id);

      firstPaymentResult = { status: pi.status, amount: firstAmt / 100 };
    } catch (err) {
      firstPaymentResult = { status: 'failed', error: (err as Error).message };
    }
  }

  return NextResponse.json({
    plan    : { type: plan_type, total, count: plan.count },
    schedule: (inserted as { id: string; amount_usd: number; due_date: string; status: string }[]).map((p, i) => ({
      id      : p.id,
      seq     : i + 1,
      label   : plan.labels[i],
      amount  : p.amount_usd,
      due_date: p.due_date,
      status  : p.status,
    })),
    first_payment: firstPaymentResult,
  }, { status: 201 });
}
