import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: sf } = await admin
    .from('brand_storefronts')
    .select('brand_name')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!sf) return NextResponse.json({ error: 'Brand storefront not found' }, { status: 404 });

  const { searchParams } = req.nextUrl;
  const lowStock = searchParams.get('low_stock') === 'true';

  let query = admin
    .from('inventory')
    .select('id, title, sku, category, season, color, sizes, stock_total, wsp_usd, srp, moq, status, image_urls, updated_at')
    .eq('brand_name', sf.brand_name)
    .neq('status', 'archived')
    .order('title', { ascending: true });

  if (lowStock) {
    // Low stock = stock_total <= moq (or < 5 as a sensible floor)
    query = query.lt('stock_total', 5);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const inventory = (data ?? []) as {
    stock_total: number; moq: number; sizes: Record<string, number>;
  }[];

  const totalUnits    = inventory.reduce((s, i) => s + (i.stock_total ?? 0), 0);
  const lowStockCount = inventory.filter(i => (i.stock_total ?? 0) <= Math.max(i.moq ?? 1, 5)).length;
  const outOfStock    = inventory.filter(i => (i.stock_total ?? 0) === 0).length;

  return NextResponse.json({
    inventory,
    summary: {
      total_skus   : inventory.length,
      total_units  : totalUnits,
      low_stock    : lowStockCount,
      out_of_stock : outOfStock,
    },
  });
}
