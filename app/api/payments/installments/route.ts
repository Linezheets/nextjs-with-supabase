import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orderId = req.nextUrl.searchParams.get('order_id');
  if (!orderId) return NextResponse.json({ error: 'order_id required' }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = supabase as any;

  // Verify order belongs to this buyer
  const { data: order } = await admin
    .from('buyer_orders')
    .select('id')
    .eq('id', orderId)
    .eq('buyer_id', user.id)
    .single();

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  const { data: installments } = await admin
    .from('buyer_payments')
    .select('id, installment_seq, amount_usd, status, due_date, method, created_at')
    .eq('order_id', orderId)
    .order('installment_seq', { ascending: true });

  return NextResponse.json({ installments: installments ?? [] });
}
