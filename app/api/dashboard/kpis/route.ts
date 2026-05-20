import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const now        = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const prevStart  = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const day90ago   = new Date(now.getTime() - 90 * 86400000).toISOString();

    const [
      { data: allOrders },
      { data: mtdOrders },
      { data: prevOrders },
      { data: pendingOrders },
      { data: recentOrders },
      { data: buyers90 },
      { data: inventory },
    ] = await Promise.all([
      supabase.from('buyer_orders').select('id, buyer_id, buyer_name, total_usd, status, terms, created_at'),
      supabase.from('buyer_orders').select('total_usd').gte('created_at', monthStart),
      supabase.from('buyer_orders').select('total_usd').gte('created_at', prevStart).lt('created_at', monthStart),
      supabase.from('buyer_orders').select('total_usd').in('status', ['new', 'confirmed']),
      supabase.from('buyer_orders').select('id, buyer_name, total_usd, terms, status, created_at').order('created_at', { ascending: false }).limit(5),
      supabase.from('buyer_orders').select('buyer_id').gte('created_at', day90ago),
      supabase.from('inventory').select('id, stock_total, status').eq('status', 'active'),
    ]);

    const revenue_mtd      = (mtdOrders    ?? []).reduce((s, o) => s + (Number(o.total_usd) || 0), 0);
    const revenue_prev     = (prevOrders   ?? []).reduce((s, o) => s + (Number(o.total_usd) || 0), 0);
    const pending_payments = (pendingOrders ?? []).reduce((s, o) => s + (Number(o.total_usd) || 0), 0);
    const revenue_change_pct = revenue_prev > 0 ? ((revenue_mtd - revenue_prev) / revenue_prev * 100) : 0;

    const open_orders    = (allOrders ?? []).filter(o => !['cancelled', 'shipped', 'delivered'].includes(o.status ?? '')).length;
    const active_buyers  = new Set((buyers90 ?? []).map(o => o.buyer_id).filter(Boolean)).size;
    const allTotals      = (allOrders ?? []).map(o => Number(o.total_usd) || 0);
    const avg_order_value = allTotals.length ? allTotals.reduce((a, b) => a + b, 0) / allTotals.length : 0;

    const skus_live      = (inventory ?? []).length;
    const total_stock    = (inventory ?? []).reduce((s, p) => s + (Number(p.stock_total) || 0), 0);
    const low_stock_count = (inventory ?? []).filter(p => (Number(p.stock_total) || 0) < 6).length;

    // Pipeline buckets
    const pipeline: Record<string, { count: number; value: number }> = {
      offers: { count: 0, value: 0 },
      new:    { count: 0, value: 0 },
      prep:   { count: 0, value: 0 },
      shipped:{ count: 0, value: 0 },
    };
    for (const o of allOrders ?? []) {
      const v = Number(o.total_usd) || 0;
      const s = o.status ?? '';
      if (s === 'offer')                                        { pipeline.offers.count++; pipeline.offers.value += v; }
      else if (s === 'new')                                     { pipeline.new.count++;    pipeline.new.value    += v; }
      else if (['confirmed','preparing','processing'].includes(s)) { pipeline.prep.count++;   pipeline.prep.value   += v; }
      else if (s === 'shipped')                                 { pipeline.shipped.count++; pipeline.shipped.value += v; }
    }

    const recent_orders = (recentOrders ?? []).map(o => ({
      id       : '#' + String(o.id).slice(-4).toUpperCase(),
      buyer    : o.buyer_name ?? 'Unknown',
      total_usd: Number(o.total_usd) || 0,
      terms    : o.terms ?? '—',
      status   : o.status ?? 'new',
      date     : new Date(o.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    }));

    return NextResponse.json({
      revenue_mtd, revenue_prev, revenue_change_pct,
      open_orders, pending_payments, overdue_payments: 0,
      active_buyers, new_buyers_week: 0,
      skus_live, total_stock, low_stock_count,
      avg_order_value, aov_change_pct: 0,
      pipeline, recent_orders,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
