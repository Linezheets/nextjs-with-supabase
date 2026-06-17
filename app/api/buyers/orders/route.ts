import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/supabase/bearer';
import { setAuditUser }  from '@/lib/supabase/set-audit-user';
import { placeOrder } from '@/lib/orders/place-order';

export async function GET(req: NextRequest) {
  const { user, supabase } = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('buyer_orders')
    .select('*')
    .eq('buyer_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ orders: data ?? [] });
}

// ─── OrderItem shape sent from buyer-order.html ───────────────────────────────
// {
//   sku        : string          // inventory SKU
//   product_id : number | string // inventory.id
//   name       : string
//   brand_name : string
//   sizes      : Record<string, number>  // { S: 2, M: 1 } — only non-zero entries
//   wsp_usd    : number
//   image_url  : string | null
// }

export async function POST(req: NextRequest) {
  const { user, supabase } = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user) await setAuditUser(supabase, user);

  let body: {
    items      : Array<Record<string, unknown>>;
    terms?     : string;
    notes?     : string;
    total_usd? : number;
    brand_name?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { items, terms, notes, total_usd, brand_name } = body;

  // Allocation + server-authoritative pricing + persistence are shared with the
  // web-cart route (POST /api/orders) via placeOrder() so the two paths cannot
  // diverge.
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

  // ── Clear cart ────────────────────────────────────────────────────────────
  try {
    if (brand_name) {
      await supabase.from('buyer_cart').delete().eq('user_id', user.id).eq('brand_name', brand_name);
    } else {
      await supabase.from('buyer_cart').delete().eq('user_id', user.id);
    }
    // Also clear the session-store cart used by buyer-shop.html
    const { setBlob } = await import('@/lib/session-store');
    await setBlob(user.id, 'cart', []);
  } catch { /* cart cleanup is non-critical */ }

  return NextResponse.json({ order: result.order, allocated: result.allocated });
}
