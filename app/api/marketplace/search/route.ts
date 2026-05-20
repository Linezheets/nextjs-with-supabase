import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = req.nextUrl;
  const q      = searchParams.get('q') ?? '';
  const limit  = Math.min(Number(searchParams.get('limit') ?? 48), 200);
  const offset = Number(searchParams.get('offset') ?? 0);

  if (!q.trim()) return NextResponse.json({ products: [], total: 0 });

  // Escape PostgREST filter special chars so user input can't break the query string
  const safe = q.replace(/[%_,()]/g, c => `\\${c}`);

  const { data, error, count } = await supabase
    .from('inventory')
    .select('id, title, brand_name, category, season, color, image_urls, srp, wsp_usd, sizes, stock_total, sku', { count: 'exact' })
    .eq('status', 'active')
    .or(`title.ilike.%${safe}%,brand_name.ilike.%${safe}%,sku.ilike.%${safe}%,category.ilike.%${safe}%,description.ilike.%${safe}%`)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ products: data ?? [], total: count ?? 0, query: q });
}
