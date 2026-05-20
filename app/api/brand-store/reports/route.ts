import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: sf } = await supabase
    .from('brand_storefronts')
    .select('brand_name')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!sf) return NextResponse.json({ error: 'No brand storefront' }, { status: 404 });

  const brandName = sf.brand_name;

  // Fetch all orders and filter client-side by brand_name inside items JSONB
  // (Supabase doesn't support JSONB array element filtering via REST easily)
  const { data: allOrders } = await supabase
    .from('buyer_orders')
    .select('id,buyer_name,status,total_usd,items,created_at')
    .order('created_at', { ascending: false });

  // Filter orders that contain this brand's items
  const orders = (allOrders ?? []).filter(order => {
    const items = Array.isArray(order.items) ? order.items : [];
    return items.some((item: Record<string, unknown>) =>
      String(item.brand_name ?? '').toLowerCase() === brandName.toLowerCase()
    );
  });

  // Extract only this brand's items from each order
  type OrderItem = { title: string; sku?: string; qty: number; wholesale_price: number; retail_price: number; brand_name: string; colour?: string; sizes?: Record<string, number> };
  const brandOrders = orders.map(order => {
    const brandItems = (order.items as Record<string, unknown>[]).filter(
      (item: Record<string, unknown>) => String(item.brand_name ?? '').toLowerCase() === brandName.toLowerCase()
    ) as unknown as OrderItem[];
    const brandTotal = brandItems.reduce((sum, i) => sum + (i.wholesale_price ?? 0) * (i.qty ?? 1), 0);
    return { ...order, items: brandItems, brand_total: brandTotal };
  });

  // Sales trend — group by month
  const monthMap: Record<string, { revenue: number; units: number; orders: number }> = {};
  for (const order of brandOrders) {
    const month = order.created_at.slice(0, 7); // YYYY-MM
    if (!monthMap[month]) monthMap[month] = { revenue: 0, units: 0, orders: 0 };
    monthMap[month].revenue += order.brand_total;
    monthMap[month].orders  += 1;
    for (const item of order.items as OrderItem[]) {
      monthMap[month].units += item.qty ?? 1;
    }
  }
  const trend = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, ...v }));

  // Top products by revenue
  const productMap: Record<string, { title: string; revenue: number; units: number; orders: number; retail_price: number; wholesale_price: number }> = {};
  for (const order of brandOrders) {
    for (const item of order.items as OrderItem[]) {
      const key = item.title ?? 'Unknown';
      if (!productMap[key]) productMap[key] = { title: key, revenue: 0, units: 0, orders: 0, retail_price: item.retail_price ?? 0, wholesale_price: item.wholesale_price ?? 0 };
      productMap[key].revenue += (item.wholesale_price ?? 0) * (item.qty ?? 1);
      productMap[key].units   += item.qty ?? 1;
      productMap[key].orders  += 1;
    }
  }
  const topProducts = Object.values(productMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // Inventory — for upsell analysis
  const { data: inventory } = await supabase
    .from('inventory')
    .select('id,title,srp,wsp_usd,category,color,season,stock_total,status')
    .eq('brand_name', brandName);

  // Storefront published product ids
  const { data: sfProducts } = await supabase
    .from('brand_storefront_products')
    .select('inventory_id,consumer_price,featured')
    .eq('storefront_id', (await supabase.from('brand_storefronts').select('id').eq('user_id', user.id).single()).data?.id ?? '');

  const publishedIds = new Set((sfProducts ?? []).map(p => p.inventory_id));

  // Upsell opportunities:
  // 1. Items ordered by buyers but NOT published on brand storefront
  // 2. Items with high order volume but low margin
  const orderedTitles = new Set(Object.keys(productMap));
  const upsells = (inventory ?? []).map(item => {
    const isPublished    = publishedIds.has(item.id);
    const isOrdered      = orderedTitles.has(item.title ?? '');
    const margin         = item.srp && item.wsp_usd ? ((item.srp - item.wsp_usd) / item.srp * 100) : null;
    const sfProduct      = (sfProducts ?? []).find(p => p.inventory_id === item.id);
    const consumerPrice  = sfProduct?.consumer_price ?? item.srp ?? 0;
    const priceGap       = item.srp && consumerPrice ? ((item.srp - consumerPrice) / item.srp * 100) : 0;

    return {
      id           : item.id,
      title        : item.title,
      category     : item.category,
      season       : item.season,
      srp          : item.srp,
      wsp_usd      : item.wsp_usd,
      margin,
      isPublished,
      isOrdered,
      priceGap,
      opportunity  : !isPublished && isOrdered ? 'Not on storefront — buyers want it'
                   : priceGap > 15            ? `Priced ${priceGap.toFixed(0)}% below SRP — potential uplift`
                   : margin !== null && margin < 40 ? 'Low margin — consider SRP adjustment'
                   : null,
    };
  }).filter(i => i.opportunity !== null);

  // Summary KPIs
  const totalRevenue = brandOrders.reduce((s, o) => s + o.brand_total, 0);
  const totalUnits   = (Object.values(productMap) as { units: number }[]).reduce((s, p) => s + p.units, 0);
  const totalOrders  = brandOrders.length;
  const avgOrderValue = totalOrders ? totalRevenue / totalOrders : 0;

  return NextResponse.json({
    kpis: { totalRevenue, totalUnits, totalOrders, avgOrderValue },
    trend,
    topProducts,
    upsells,
    recentOrders: brandOrders.slice(0, 20),
  });
}
