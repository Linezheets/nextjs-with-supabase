import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  // Get all payment rows grouped by order
  const { data: payments, error } = await admin
    .from('buyer_payments')
    .select(`
      id, order_id, amount_usd, installment_seq, due_date, status,
      stripe_payment_intent_id, method, created_at,
      buyer_orders!inner(id, buyer_id, total_usd, items, status, payment_status)
    `)
    .eq('buyer_orders.buyer_id', user.id)
    .order('order_id')
    .order('installment_seq', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Group payments by order_id
  const planMap: Record<string, {
    order_id    : string;
    total_usd   : number;
    items       : unknown[];
    status      : string;
    installments: unknown[];
  }> = {};

  for (const p of (payments ?? []) as {
    order_id    : string;
    amount_usd  : number;
    installment_seq: number;
    due_date    : string;
    status      : string;
    buyer_orders: { total_usd: number; items: unknown[]; status: string };
  }[]) {
    if (!planMap[p.order_id]) {
      planMap[p.order_id] = {
        order_id    : p.order_id,
        total_usd   : p.buyer_orders.total_usd,
        items       : p.buyer_orders.items,
        status      : p.buyer_orders.status,
        installments: [],
      };
    }
    planMap[p.order_id].installments.push(p);
  }

  return NextResponse.json({ plans: Object.values(planMap) });
}
