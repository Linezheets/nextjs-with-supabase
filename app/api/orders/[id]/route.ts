import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sf } = await admin
    .from('brand_storefronts')
    .select('brand_name')
    .eq('user_id', user.id)
    .maybeSingle();

  let query = admin
    .from('buyer_orders')
    .select('*, buyer_payments(id, installment_seq, amount_usd, status, due_date, method)')
    .eq('id', id);

  if (sf) {
    // Brand can see any order for their brand
    query = query.eq('items->0->>brand_name', sf.brand_name);
  } else {
    // Buyer can only see their own orders
    query = query.eq('buyer_id', user.id);
  }

  const { data, error } = await query.maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)  return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  return NextResponse.json({ order: data });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as { status?: string; notes?: string };

  const allowed = ['status', 'notes'];
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (body[key as keyof typeof body] !== undefined) patch[key] = body[key as keyof typeof body];
  }

  if (Object.keys(patch).length === 1) {
    return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  // Only buyer can update their own order; only brand can update status
  const { data: sf } = await admin
    .from('brand_storefronts')
    .select('brand_name')
    .eq('user_id', user.id)
    .maybeSingle();

  let query = admin.from('buyer_orders').update(patch).eq('id', id);

  if (sf) {
    query = query.eq('items->0->>brand_name', sf.brand_name);
  } else {
    // Buyers can only update notes, not status
    delete patch['status'];
    query = admin.from('buyer_orders').update(patch).eq('id', id).eq('buyer_id', user.id);
  }

  const { data, error } = await query.select().maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)  return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  return NextResponse.json({ order: data });
}
