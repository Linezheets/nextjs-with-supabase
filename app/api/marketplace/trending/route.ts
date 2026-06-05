import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  // Invite-only platform — require authenticated session
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = req.nextUrl;
  const limit     = Math.min(Number(searchParams.get('limit') ?? 12), 48);
  const brandSlug = searchParams.get('brand') ?? null;

  let q = supabase
    .from('inventory')
    .select('id, title, brand_name, category, season, color, image_urls, srp, wsp_usd, sizes, stock_total, status')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (brandSlug) q = q.ilike('brand_name', `%${brandSlug}%`);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ products: data ?? [], total: (data ?? []).length });
}
