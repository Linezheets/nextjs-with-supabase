import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export type SellThroughRow = {
  inventory_id : number;
  title        : string;
  sku          : string | null;
  category     : string;
  color        : string;
  season       : string | null;
  line         : string | null;
  stock_total  : number;
  wsp_usd      : number;
  units_ordered: number;
  revenue_usd  : number;
  order_count  : number;
  sizes_ordered: Record<string, number>;
  // computed
  sell_through_pct: number;   // units_ordered / (units_ordered + stock_total)
  status          : 'strong' | 'moving' | 'slow' | 'dead';
};

function classify(unitsOrdered: number, stockTotal: number): SellThroughRow['status'] {
  const total = unitsOrdered + stockTotal;
  if (total === 0) return 'dead';
  const pct = unitsOrdered / total;
  if (pct >= 0.7) return 'strong';
  if (pct >= 0.35) return 'moving';
  if (unitsOrdered > 0) return 'slow';
  return 'dead';
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const since = searchParams.get('since'); // ISO date string

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sf } = await (supabase as any)
    .from('brand_storefronts')
    .select('brand_name, base_currency')
    .eq('user_id', user.id)
    .single() as { data: { brand_name: string; base_currency: string | null } | null };

  if (!sf) return NextResponse.json({ error: 'Brand storefront not found' }, { status: 404 });

  // Try RPC first; fall back to client-side aggregation if function not yet deployed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: rpcRows, error: rpcErr } = await db.rpc('get_brand_sell_through', {
    p_brand_name: sf.brand_name,
    ...(since ? { p_since: since } : {}),
  });

  if (rpcErr) {
    // Fallback: fetch inventory + orders separately and aggregate in JS
    const [{ data: inventory }, { data: allOrders }] = await Promise.all([
      supabase
        .from('inventory')
        .select('id, title, sku, category, color, season, line, stock_total, wsp_usd')
        .eq('brand_name', sf.brand_name)
        .neq('status', 'archived'),
      supabase
        .from('buyer_orders')
        .select('id, items, created_at')
        .order('created_at', { ascending: false }),
    ]);

    type Item = { title?: string; brand_name?: string; qty?: number; wholesale_price?: number; colour?: string; sizes?: Record<string, number> };

    // Filter and aggregate orders in JS
    const brandName = sf.brand_name.toLowerCase();
    const orderSince = since ? new Date(since) : null;

    const itemMap: Record<string, { units: number; revenue: number; orders: Set<string>; sizes: Record<string, number> }> = {};

    for (const order of (allOrders ?? [])) {
      if (orderSince && new Date(order.created_at) < orderSince) continue;
      const items: Item[] = Array.isArray(order.items) ? order.items : [];
      for (const item of items) {
        if ((item.brand_name ?? '').toLowerCase() !== brandName) continue;
        const key = (item.title ?? '').toLowerCase();
        if (!itemMap[key]) itemMap[key] = { units: 0, revenue: 0, orders: new Set(), sizes: {} };
        const qty = item.qty ?? 1;
        itemMap[key].units += qty;
        itemMap[key].revenue += (item.wholesale_price ?? 0) * qty;
        itemMap[key].orders.add(order.id);
        for (const [sz, szQty] of Object.entries(item.sizes ?? {})) {
          itemMap[key].sizes[sz] = (itemMap[key].sizes[sz] ?? 0) + Number(szQty);
        }
      }
    }

    const rows: SellThroughRow[] = (inventory ?? []).map(inv => {
      const agg = itemMap[(inv.title ?? '').toLowerCase()];
      const unitsOrdered = agg?.units ?? 0;
      const stockTotal = inv.stock_total ?? 0;
      const total = unitsOrdered + stockTotal;
      return {
        inventory_id: inv.id,
        title: inv.title ?? '',
        sku: inv.sku,
        category: inv.category ?? '',
        color: inv.color ?? '',
        season: inv.season,
        line: inv.line,
        stock_total: stockTotal,
        wsp_usd: inv.wsp_usd ?? 0,
        units_ordered: unitsOrdered,
        revenue_usd: agg?.revenue ?? 0,
        order_count: agg?.orders.size ?? 0,
        sizes_ordered: agg?.sizes ?? {},
        sell_through_pct: total > 0 ? Math.round((unitsOrdered / total) * 100) : 0,
        status: classify(unitsOrdered, stockTotal),
      };
    });

    return NextResponse.json(buildResponse(rows, sf.brand_name, sf.base_currency ?? 'USD'));
  }

  // Transform RPC rows
  const rows: SellThroughRow[] = (rpcRows ?? []).map((r: Omit<SellThroughRow, 'sell_through_pct' | 'status'>) => {
    const total = r.units_ordered + r.stock_total;
    return {
      ...r,
      sell_through_pct: total > 0 ? Math.round((r.units_ordered / total) * 100) : 0,
      status: classify(r.units_ordered, r.stock_total),
    };
  });

  return NextResponse.json(buildResponse(rows, sf.brand_name));
}

// ── Build aggregated response ─────────────────────────────────────────────────

function buildResponse(rows: SellThroughRow[], brandName: string, currency = 'USD') {
  // By color
  const colorMap: Record<string, { units_ordered: number; revenue_usd: number; sku_count: number; sell_through_sum: number }> = {};
  for (const r of rows) {
    const c = r.color || 'Unknown';
    if (!colorMap[c]) colorMap[c] = { units_ordered: 0, revenue_usd: 0, sku_count: 0, sell_through_sum: 0 };
    colorMap[c].units_ordered += r.units_ordered;
    colorMap[c].revenue_usd  += r.revenue_usd;
    colorMap[c].sku_count    += 1;
    colorMap[c].sell_through_sum += r.sell_through_pct;
  }
  const byColor = Object.entries(colorMap)
    .map(([color, v]) => ({ color, ...v, avg_sell_through: Math.round(v.sell_through_sum / v.sku_count) }))
    .sort((a, b) => b.units_ordered - a.units_ordered);

  // By category
  const catMap: Record<string, { units_ordered: number; revenue_usd: number; sku_count: number; sell_through_sum: number }> = {};
  for (const r of rows) {
    const c = r.category || 'Other';
    if (!catMap[c]) catMap[c] = { units_ordered: 0, revenue_usd: 0, sku_count: 0, sell_through_sum: 0 };
    catMap[c].units_ordered += r.units_ordered;
    catMap[c].revenue_usd  += r.revenue_usd;
    catMap[c].sku_count    += 1;
    catMap[c].sell_through_sum += r.sell_through_pct;
  }
  const byCategory = Object.entries(catMap)
    .map(([category, v]) => ({ category, ...v, avg_sell_through: Math.round(v.sell_through_sum / v.sku_count) }))
    .sort((a, b) => b.units_ordered - a.units_ordered);

  // Global size curve (sum across all SKUs)
  const sizeMap: Record<string, number> = {};
  for (const r of rows) {
    for (const [sz, qty] of Object.entries(r.sizes_ordered)) {
      sizeMap[sz] = (sizeMap[sz] ?? 0) + Number(qty);
    }
  }
  const totalSizeUnits = Object.values(sizeMap).reduce((s, n) => s + n, 0);
  const sizeCurve = Object.entries(sizeMap)
    .map(([size, units]) => ({ size, units, pct: totalSizeUnits > 0 ? Math.round((units / totalSizeUnits) * 100) : 0 }))
    .sort((a, b) => b.units - a.units);

  // Status summary
  const statusCounts = { strong: 0, moving: 0, slow: 0, dead: 0 };
  for (const r of rows) statusCounts[r.status]++;

  // Production signals
  const signals: { type: 'reorder' | 'cut' | 'watch' | 'cancel'; title: string; reason: string; inventory_id: number }[] = [];
  for (const r of rows) {
    if (r.status === 'strong' && r.stock_total < 10) {
      signals.push({ type: 'reorder', title: r.title, reason: `${r.sell_through_pct}% sold through, only ${r.stock_total} units left`, inventory_id: r.inventory_id });
    } else if (r.status === 'dead' && r.stock_total > 20) {
      signals.push({ type: 'cancel', title: r.title, reason: `0 orders, ${r.stock_total} units in stock`, inventory_id: r.inventory_id });
    } else if (r.status === 'slow' && r.stock_total > 30) {
      signals.push({ type: 'cut', title: r.title, reason: `${r.sell_through_pct}% sell-through, ${r.stock_total} units on hand`, inventory_id: r.inventory_id });
    } else if (r.status === 'moving' && r.sell_through_pct > 55) {
      signals.push({ type: 'watch', title: r.title, reason: `${r.sell_through_pct}% sell-through — approaching reorder point`, inventory_id: r.inventory_id });
    }
  }

  return {
    brand_name: brandName,
    currency,
    skus: rows,
    by_color: byColor,
    by_category: byCategory,
    size_curve: sizeCurve,
    status_counts: statusCounts,
    production_signals: signals.slice(0, 30),
    total_revenue: rows.reduce((s, r) => s + r.revenue_usd, 0),
    total_units: rows.reduce((s, r) => s + r.units_ordered, 0),
  };
}
