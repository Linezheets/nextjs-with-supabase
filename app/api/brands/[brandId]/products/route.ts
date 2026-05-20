import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ brandId: string }> }) {
  const supabase = await createClient();
  const { brandId } = await params;
  const { searchParams } = req.nextUrl;
  const category = searchParams.get('category');
  const search   = searchParams.get('search');
  const limit    = Math.min(Number(searchParams.get('limit')  ?? 48), 200);
  const offset   = Number(searchParams.get('offset') ?? 0);

  const { data, error } = await supabase
    .from('brand_storefront_products')
    .select('id, inventory_id, consumer_price, featured, published, inventory:inventory_id(id, title, sku, brand_name, category, season, color, image_urls, srp, wsp_usd, sizes, stock_total, material, description)')
    .eq('storefront_id', brandId)
    .eq('published', true)
    .order('featured',    { ascending: false })
    .order('sort_order',  { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let products = (data ?? []).map((row: any) => ({
    ...row.inventory,
    storefront_product_id: row.id,
    consumer_price       : row.consumer_price,
    featured             : row.featured,
  }));

  if (category) products = products.filter((p: { category?: string }) => p.category === category);
  if (search) {
    const s = search.toLowerCase();
    products = products.filter((p: { title?: string; brand_name?: string }) =>
      (p.title ?? '').toLowerCase().includes(s) || (p.brand_name ?? '').toLowerCase().includes(s));
  }

  return NextResponse.json({ products, total: products.length });
}
