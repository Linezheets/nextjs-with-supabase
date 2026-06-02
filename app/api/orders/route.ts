import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { setBlob } from '@/lib/session-store';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('buyer_orders')
    .select('*')
    .eq('buyer_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ orders: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { items, terms, notes, total_usd, brand_name } = await req.json();
  if (!items?.length) return NextResponse.json({ error: 'items required' }, { status: 400 });

  const id = `LZ-${Date.now()}`;

  const { data, error } = await supabase
    .from('buyer_orders')
    .insert({
      id,
      buyer_id  : user.id,
      buyer_name: user.email ?? user.id,
      status    : 'new',
      total_usd : total_usd ?? 0,
      terms     : terms ?? null,
      notes     : notes ?? null,
      items,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Clear cart after order placed (cart lives in session_store, not buyer_cart)
  if (brand_name) {
    // Partial clear: remove only items for this brand
    const { getBlob } = await import('@/lib/session-store');
    type CartItem = { brand_name?: string | null; [k: string]: unknown };
    const current = (await getBlob<CartItem[]>(user.id, 'cart')) ?? [];
    await setBlob(user.id, 'cart', current.filter(i => i.brand_name !== brand_name));
  } else {
    await setBlob(user.id, 'cart', []);
  }

  return NextResponse.json({ order: data });
}
