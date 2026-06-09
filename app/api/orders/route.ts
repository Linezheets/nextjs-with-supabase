import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { setBlob } from '@/lib/session-store';
import { priceOrderForBuyer } from '@/lib/order-pricing';

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

  const { items, terms, notes, brand_name } = await req.json();
  if (!items?.length) return NextResponse.json({ error: 'items required' }, { status: 400 });

  // ── Recompute the authoritative total server-side ─────────────────────────
  // SECURITY: never trust the client `total_usd`. Normalise to {sku, total_qty}
  // and re-price from the buyer's catalog. (This route has no stock allocation;
  // prefer /api/buyers/orders. Kept hardened so it cannot be used to forge totals.)
  const normalised = (items as Array<Record<string, unknown>>).map(item => {
    let qty = 0;
    if (item.sizes && typeof item.sizes === 'object' && !Array.isArray(item.sizes)) {
      for (const v of Object.values(item.sizes as Record<string, unknown>)) qty += Math.max(0, Number(v) || 0);
    } else if (item.quantity) {
      qty = Math.max(0, Number(item.quantity) || 0);
    }
    return { sku: String(item.sku ?? '').trim(), total_qty: qty };
  }).filter(i => i.sku && i.total_qty > 0);

  if (normalised.length === 0) {
    return NextResponse.json({ error: 'No items with valid SKUs and quantities' }, { status: 400 });
  }

  const pricing = await priceOrderForBuyer(createAdminClient(), user.email, normalised);
  if (!pricing.ok) {
    return NextResponse.json({ error: pricing.error, missing_skus: pricing.missingSkus }, { status: 422 });
  }
  if (pricing.brands.length > 1) {
    return NextResponse.json(
      { error: 'An order may only contain items from one brand. Please place a separate order per brand.', brands: pricing.brands },
      { status: 400 },
    );
  }
  const serverTotal = pricing.totalUsd;
  const orderBrand  = pricing.brands[0] ?? brand_name ?? null;

  const id = `LZ-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const { data, error } = await supabase
    .from('buyer_orders')
    .insert({
      id,
      buyer_id  : user.id,
      buyer_name: user.email ?? user.id,
      status    : 'new',
      total_usd : serverTotal,        // server-computed, not client input
      currency  : 'USD',              // server-controlled (money basis is USD)
      brand_name: orderBrand,         // single authoritative brand for the order
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
