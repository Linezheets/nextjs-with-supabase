import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { updateOrderStatus } from '@/lib/orders/update-status';

// Resolve the brand_name for the authenticated user
async function getBrandName(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from('brand_storefronts')
    .select('brand_name')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.brand_name as string | null;
}

type OrderRow = {
  id              : string;
  buyer_id        : string | null;
  buyer_name      : string | null;
  status          : string;
  payment_status  : string | null;
  total_usd       : number;
  terms           : string | null;
  notes           : string | null;
  items           : Record<string, unknown>[];
  created_at      : string;
  fulfillment_type: string | null;
};

// GET /api/brand/orders
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const brandName = await getBrandName(supabase, user.id);
  if (!brandName) return NextResponse.json({ error: 'No brand storefront found' }, { status: 403 });

  // @> filter: orders whose items array contains at least one object with this brand_name
  const { data, error } = await supabase
    .from('buyer_orders')
    .select('id, buyer_id, buyer_name, status, total_usd, terms, notes, items, created_at, fulfillment_type')
    .filter('items', 'cs', JSON.stringify([{ brand_name: brandName }]))
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch payment_status separately — column exists but may not be in generated types
  const ids = ((data ?? []) as unknown as OrderRow[]).map(o => o.id);
  let paymentMap: Record<string, string | null> = {};
  if (ids.length > 0) {
    const { data: payRows } = await supabase
      .from('buyer_orders')
      .select('id, payment_status')
      .in('id', ids) as unknown as { data: { id: string; payment_status: string | null }[] | null };
    for (const r of payRows ?? []) paymentMap[r.id] = r.payment_status;
  }

  const orders = ((data ?? []) as unknown as OrderRow[]).map(order => {
    const allItems  = (order.items ?? []) as Record<string, unknown>[];
    const brandItems = allItems.filter(i => i.brand_name === brandName);
    const brandTotal = brandItems.reduce((sum, i) => {
      return sum + Number(i.wholesale_price ?? i.wsp_usd ?? 0) * Number(i.qty ?? i.total_qty ?? 1);
    }, 0);
    return {
      ...order,
      payment_status: paymentMap[order.id] ?? null,
      brand_items   : brandItems,
      brand_total   : brandTotal,
    };
  });

  return NextResponse.json({ orders, brand_name: brandName });
}

// PATCH /api/brand/orders  { order_id, status }
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const brandName = await getBrandName(supabase, user.id);
  if (!brandName) return NextResponse.json({ error: 'No brand storefront found' }, { status: 403 });

  let body: { order_id?: string; status?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { order_id, status } = body;
  if (!order_id || !status) return NextResponse.json({ error: 'order_id and status required' }, { status: 400 });

  // Delegate to the single canonical state machine instead of a private
  // transition table. This previously wrote 'preparing' and topped out at
  // 'shipped', bypassing TRANSITIONS, the stock-restore-on-cancel hook, and the
  // 'delivered' escrow auto-release. updateOrderStatus enforces all three and
  // scopes the order to the brand via buyer_orders.brand_name.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const result = await updateOrderStatus(admin, { orderId: order_id, brandName, toStatus: status });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.httpStatus });

  return NextResponse.json({ ok: true, order_id, status, escrow_release: result.escrowRelease });
}
