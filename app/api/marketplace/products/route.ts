import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/supabase/bearer';

export async function GET(req: NextRequest) {
  // Public catalog — no auth required for browsing. Bearer token accepted for personalisation.
  const { user, supabase } = await getUserFromRequest(req);
  // Wholesale price (wsp_usd) and tier pricing are CONFIDENTIAL — only authenticated
  // (approved buyer) callers may see them. Unauthenticated browsing uses retail (srp).
  const isPublic = !user;
  const priceCol = isPublic ? 'srp' : 'wsp_usd';

  const { searchParams } = req.nextUrl;
  const category  = searchParams.get('category');
  const season    = searchParams.get('season');
  const search    = searchParams.get('search') ?? searchParams.get('q');
  const sort      = searchParams.get('sort') ?? 'newest';
  const minPrice  = searchParams.get('min_price');
  const maxPrice  = searchParams.get('max_price');
  const limit     = Math.min(Number(searchParams.get('limit')  ?? 48), 200);
  const offset    = Number(searchParams.get('offset') ?? 0);

  const sortMap: Record<string, { col: string; asc: boolean }> = {
    newest     : { col: 'created_at',  asc: false },
    price_asc  : { col: priceCol,      asc: true  },
    price_desc : { col: priceCol,      asc: false },
    popular    : { col: 'stock_total', asc: false },
  };
  const { col: sortCol, asc: sortAsc } = sortMap[sort] ?? sortMap.newest;

  let q = supabase
    .from('inventory')
    .select('id, title, description, sku, category, season, color, gender, brand_name, brand_id, image_urls, srp, wsp_usd, sizes, stock_total, moq, material, tier_pricing, tags, status, created_at', { count: 'exact' })
    .eq('status', 'active')
    .order(sortCol, { ascending: sortAsc })
    .range(offset, offset + limit - 1);

  if (category)  q = q.eq('category', category);
  if (season)    q = q.eq('season', season);
  if (minPrice)  q = q.gte(priceCol, Number(minPrice));
  if (maxPrice)  q = q.lte(priceCol, Number(maxPrice));
  if (search) {
    const safe = search.replace(/[%_,()]/g, c => `\\${c}`);
    q = q.or(`title.ilike.%${safe}%,brand_name.ilike.%${safe}%,sku.ilike.%${safe}%`);
  }

  const { data, error, count } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Strip confidential wholesale fields for unauthenticated callers.
  let products = data ?? [];
  if (isPublic) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    products = (products as any[]).map(p => { const c = { ...p }; delete c.wsp_usd; delete c.tier_pricing; return c; });
  }

  return NextResponse.json({ products, total: count ?? 0, offset, limit });
}
