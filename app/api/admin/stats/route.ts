import { NextRequest, NextResponse } from 'next/server';;
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/supabase/requireAdmin';

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const [buyersRes, ordersRes, gmvRes, brandsRes] = await Promise.all([
    admin.from('buyers').select('status', { count: 'exact', head: false }),
    admin.from('buyer_orders').select('status, payment_status, total_usd, created_at', { count: 'exact', head: false }),
    admin.from('buyer_payments').select('amount_usd, status'),
    admin.from('brand_storefronts').select('subscription_status, subscription_tier, created_at'),
  ]);

  const buyers    = (buyersRes.data ?? []) as { status: string }[];
  const orders    = (ordersRes.data ?? []) as { status: string; payment_status: string; total_usd: number; created_at: string }[];
  const payments  = (gmvRes.data ?? [])   as { amount_usd: number; status: string }[];
  const brands    = (brandsRes.data ?? []) as { subscription_status: string; subscription_tier: string; created_at: string }[];

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const totalGmv   = payments.filter(p => p.status === 'succeeded').reduce((s, p) => s + Number(p.amount_usd), 0);
  const gmv30d     = orders.filter(o => o.created_at >= thirtyDaysAgo).reduce((s, o) => s + Number(o.total_usd), 0);
  const orders30d  = orders.filter(o => o.created_at >= thirtyDaysAgo).length;

  return NextResponse.json({
    buyers: {
      total  : buyers.length,
      pending: buyers.filter(b => b.status === 'pending').length,
      verified: buyers.filter(b => b.status === 'verified').length,
    },
    orders: {
      total  : orders.length,
      paid   : orders.filter(o => o.payment_status === 'paid').length,
      last_30d: orders30d,
    },
    gmv: {
      total_gmv: totalGmv,
      gmv_30d  : gmv30d,
    },
    brands: {
      total   : brands.length,
      active  : brands.filter(b => b.subscription_status === 'active').length,
      trialing: brands.filter(b => b.subscription_status === 'trialing').length,
    },
  });
}
