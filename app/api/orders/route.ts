import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { setBlob } from '@/lib/session-store';
import { placeOrder } from '@/lib/orders/place-order';

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

  let body: { items?: Array<Record<string, unknown>>; terms?: string; notes?: string; brand_name?: string; total_usd?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const { items, terms, notes, brand_name, total_usd } = body;
  if (!items?.length) return NextResponse.json({ error: 'items required' }, { status: 400 });

  // Stock allocation + server-authoritative pricing live in the shared helper,
  // so this web-cart path can no longer oversell (the old version inserted an
  // order without ever decrementing inventory).
  const result = await placeOrder({
    buyer         : { id: user.id, email: user.email },
    items,
    terms,
    notes,
    brand_name,
    clientTotalUsd: total_usd ?? null,
    req,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error, ...(result.extra ?? {}) }, { status: result.httpStatus });
  }

  // Clear cart after order placed (web cart lives in session_store, not buyer_cart)
  try {
    if (brand_name) {
      // Partial clear: remove only items for this brand
      const { getBlob } = await import('@/lib/session-store');
      type CartItem = { brand_name?: string | null; [k: string]: unknown };
      const current = (await getBlob<CartItem[]>(user.id, 'cart')) ?? [];
      await setBlob(user.id, 'cart', current.filter(i => i.brand_name !== brand_name));
    } else {
      await setBlob(user.id, 'cart', []);
    }
  } catch { /* cart cleanup is non-critical */ }

  return NextResponse.json({ order: result.order, allocated: result.allocated });
}
