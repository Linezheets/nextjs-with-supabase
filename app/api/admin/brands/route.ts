import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/supabase/requireAdmin';

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin  = createAdminClient() as any;
  const { searchParams } = req.nextUrl;
  const status = searchParams.get('status');
  const limit  = Math.min(parseInt(searchParams.get('limit')  ?? '50'), 200);
  const offset = parseInt(searchParams.get('offset') ?? '0');

  let query = admin
    .from('brand_storefronts')
    .select('id, user_id, brand_name, display_name, slug, published, subscription_tier, subscription_status, stripe_account_status, created_at')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq('subscription_status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich with product counts per brand
  const enriched = await Promise.all(
    ((data ?? []) as { id: string; brand_name: string; [key: string]: unknown }[]).map(async sf => {
      const { count } = await admin
        .from('inventory')
        .select('id', { count: 'exact', head: true })
        .eq('brand_name', sf.brand_name)
        .eq('status', 'active');
      return { ...sf, product_count: count ?? 0 };
    }),
  );

  return NextResponse.json({ brands: enriched });
}
