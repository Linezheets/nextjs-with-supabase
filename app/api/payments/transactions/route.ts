import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const limit  = Math.min(parseInt(searchParams.get('limit')  ?? '50'), 100);
  const offset = parseInt(searchParams.get('offset') ?? '0');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  // Determine if user is a brand (has a storefront) or a buyer
  const { data: sf } = await admin
    .from('brand_storefronts')
    .select('brand_name')
    .eq('user_id', user.id)
    .maybeSingle();

  let query = admin
    .from('buyer_payments')
    .select(`
      id,
      order_id,
      method,
      status,
      payment_attempt_status,
      amount_usd,
      installment_seq,
      due_date,
      stripe_payment_intent_id,
      created_at,
      updated_at,
      buyer_orders!inner(id, buyer_id, brand_id, items, total_usd)
    `)
    .not('status', 'eq', 'pending')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (sf) {
    // Brand: filter to payments for orders with their brand_name in items
    query = query.eq('buyer_orders.items->0->>brand_name', sf.brand_name);
  } else {
    // Buyer: filter to their own orders
    query = query.eq('buyer_orders.buyer_id', user.id);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ transactions: data ?? [] });
}
